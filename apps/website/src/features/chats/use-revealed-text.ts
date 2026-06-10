import * as React from 'react';

const catchUpWindowMs = 110;
const maxRevealCharsPerMs = 5;

/**
 * Smooths streamed text by revealing it toward the latest target at a paced
 * rate instead of snapping on every network update. Bursty deltas smear into
 * a steady reveal: small backlogs catch up within roughly catchUpWindowMs,
 * and large end-of-turn bursts are capped at maxRevealCharsPerMs so they stay
 * visibly continuous. The reveal keeps running until it finishes even after
 * the stream ends — enabled only controls whether the text starts hidden or
 * fully shown. When the new text does not extend what is already shown (a
 * segment reset), the reveal restarts from the shared prefix.
 */
export function useRevealedText(text: string, enabled: boolean) {
    const [visibleLength, setVisibleLength] = React.useState(() => (enabled ? 0 : text.length));
    const targetRef = React.useRef(text);

    if (targetRef.current !== text) {
        const previous = targetRef.current;
        targetRef.current = text;

        if (!text.startsWith(previous.slice(0, Math.min(visibleLength, previous.length)))) {
            setVisibleLength(commonPrefixLength(previous, text));
        }
    }

    React.useEffect(() => {
        if (prefersReducedMotion()) {
            setVisibleLength(text.length);
            return;
        }

        if (visibleLength >= text.length) {
            return;
        }

        let frame = 0;
        let lastFrameAt = performance.now();

        const reveal = (now: number) => {
            const elapsedMs = Math.max(0, now - lastFrameAt);
            lastFrameAt = now;
            setVisibleLength((current) => {
                const remaining = text.length - current;

                if (remaining <= 0) {
                    return current;
                }

                const step = Math.max(
                    1,
                    Math.min(
                        Math.round(remaining * Math.min(1, elapsedMs / catchUpWindowMs)),
                        Math.round(elapsedMs * maxRevealCharsPerMs)
                    )
                );

                return Math.min(text.length, current + step);
            });
            frame = requestAnimationFrame(reveal);
        };

        frame = requestAnimationFrame(reveal);

        return () => cancelAnimationFrame(frame);
    }, [text, visibleLength]);

    return text.slice(0, Math.min(visibleLength, text.length));
}

function commonPrefixLength(left: string, right: string) {
    const limit = Math.min(left.length, right.length);
    let index = 0;

    while (index < limit && left[index] === right[index]) {
        index += 1;
    }

    return index;
}

function prefersReducedMotion() {
    return (
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
}
