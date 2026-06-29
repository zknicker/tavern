import * as React from 'react';

const moveActivationPx = 4;

/**
 * Turns a lone tab into a window-drag handle: pointer-down then a small move starts the
 * window move (desktop main process follows the cursor and merges on a strip drop);
 * release commits it. A plain click never triggers a move. No-op when `enabled` is false.
 */
export function useWindowMoveHandle(
    enabled: boolean,
    onStart: () => void,
    onFinish: () => void
): (event: React.PointerEvent) => void {
    const origin = React.useRef<{ x: number; y: number } | null>(null);
    const moving = React.useRef(false);
    const moveRef = React.useRef<(event: PointerEvent) => void>(() => undefined);
    const upRef = React.useRef<(event: PointerEvent) => void>(() => undefined);

    return React.useCallback(
        (event: React.PointerEvent) => {
            if (!enabled || event.button !== 0) {
                return;
            }

            origin.current = { x: event.clientX, y: event.clientY };
            moving.current = false;

            moveRef.current = (move) => {
                const start = origin.current;

                if (!start) {
                    return;
                }

                if (
                    !moving.current &&
                    Math.hypot(move.clientX - start.x, move.clientY - start.y) > moveActivationPx
                ) {
                    moving.current = true;
                    onStart();
                }
            };

            upRef.current = () => {
                window.removeEventListener('pointermove', moveRef.current, true);
                window.removeEventListener('pointerup', upRef.current, true);

                if (moving.current) {
                    onFinish();
                }

                moving.current = false;
                origin.current = null;
            };

            window.addEventListener('pointermove', moveRef.current, true);
            window.addEventListener('pointerup', upRef.current, true);
        },
        [enabled, onStart, onFinish]
    );
}
