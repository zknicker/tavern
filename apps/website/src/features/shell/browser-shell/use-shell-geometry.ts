import * as React from 'react';
import type { OutlineGeometry } from './geometry.ts';

/**
 * Measures the active-tab/shell hairline geometry against `frameRef`, querying the
 * live `.chrome-tab--active` element and the `[data-toolbar]` boundary. Re-measures
 * on layout changes (via `deps`), on resize, and — while `dragging` and through the
 * drop/settle animation afterwards — every frame, so the hairline follows the tab
 * live instead of freezing at the release position.
 */
export function useShellGeometry(
    frameRef: React.RefObject<HTMLDivElement | null>,
    dragging: boolean,
    deps: React.DependencyList
): { outline: OutlineGeometry | null; measure: () => void } {
    const [outline, setOutline] = React.useState<OutlineGeometry | null>(null);

    const measure = React.useCallback(() => {
        const frame = frameRef.current;

        if (!frame) {
            return;
        }

        // Prefer the drag overlay's tab while it exists (during the drag and its drop
        // animation) so the hairline tracks the lifted/settling tab, not the placeholder.
        const active =
            frame.querySelector<HTMLElement>('[data-tab-overlay] .chrome-tab--active') ??
            frame.querySelector<HTMLElement>('.chrome-tab--active');
        const toolbar = frame.querySelector<HTMLElement>('[data-toolbar]');

        if (!(active && toolbar)) {
            setOutline(null);
            return;
        }

        const f = frame.getBoundingClientRect();
        const a = active.getBoundingClientRect();
        const tb = toolbar.getBoundingClientRect();

        setOutline({
            w: f.width,
            boundaryY: tb.top - f.top,
            tabLeft: a.left - f.left,
            tabRight: a.right - f.left,
        });
    }, [frameRef]);

    // Re-measure on layout dependencies and on resize.
    React.useLayoutEffect(() => {
        measure();
        const frame = frameRef.current;

        if (!frame) {
            return;
        }

        const ro = new ResizeObserver(measure);
        ro.observe(frame);

        return () => ro.disconnect();
    }, [measure, frameRef, ...deps]);

    // Track a tab's entry animation: the `.chrome-tab-enter` wrapper transforms the active
    // tab's box, so re-measure each frame between its transition start and end — otherwise
    // the hairline freezes at the animation's start position, offset from the settled tab.
    React.useEffect(() => {
        const frame = frameRef.current;

        if (!frame) {
            return;
        }

        let raf = 0;
        let running = 0;
        const loop = () => {
            measure();
            raf = requestAnimationFrame(loop);
        };
        const isEntering = (event: TransitionEvent) =>
            event.target instanceof Element && event.target.closest('.chrome-tab-enter') !== null;
        const onStart = (event: TransitionEvent) => {
            if (isEntering(event) && running++ === 0) {
                cancelAnimationFrame(raf);
                raf = requestAnimationFrame(loop);
            }
        };
        const onEnd = (event: TransitionEvent) => {
            if (!isEntering(event)) {
                return;
            }

            running = Math.max(0, running - 1);

            if (running === 0) {
                cancelAnimationFrame(raf);
                measure(); // final measure at the settled position
            }
        };

        frame.addEventListener('transitionstart', onStart);
        frame.addEventListener('transitionend', onEnd);
        frame.addEventListener('transitioncancel', onEnd);

        return () => {
            cancelAnimationFrame(raf);
            frame.removeEventListener('transitionstart', onStart);
            frame.removeEventListener('transitionend', onEnd);
            frame.removeEventListener('transitioncancel', onEnd);
        };
    }, [measure, frameRef]);

    // Track the drag + settle with a per-frame loop.
    const wasDragging = React.useRef(false);
    React.useEffect(() => {
        let raf = 0;

        if (dragging) {
            wasDragging.current = true;
            const loop = () => {
                measure();
                raf = requestAnimationFrame(loop);
            };
            raf = requestAnimationFrame(loop);
        } else if (wasDragging.current) {
            wasDragging.current = false;
            let frames = 0;
            const loop = () => {
                measure();

                if (++frames < 24) {
                    raf = requestAnimationFrame(loop); // ~0.4s settle
                }
            };
            raf = requestAnimationFrame(loop);
        }

        return () => cancelAnimationFrame(raf);
    }, [dragging, measure]);

    return { outline, measure };
}
