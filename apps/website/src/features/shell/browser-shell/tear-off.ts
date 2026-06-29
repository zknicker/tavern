export interface Rect {
    bottom: number;
    left: number;
    right: number;
    top: number;
}

export interface Point {
    x: number;
    y: number;
}

/** Distance past the strip edge a drag must travel before a release detaches the tab. */
export const TEAR_OFF_THRESHOLD_PX = 48;

/**
 * True when the pointer has left the tab strip far enough that releasing should tear the
 * tab out into its own window (Chrome-style), rather than reordering within the strip.
 * Dragging down into the content area is the natural gesture; leaving any edge counts.
 */
export function shouldTearOff(
    pointer: Point,
    strip: Rect,
    threshold = TEAR_OFF_THRESHOLD_PX
): boolean {
    return (
        pointer.y > strip.bottom + threshold ||
        pointer.y < strip.top - threshold ||
        pointer.x < strip.left - threshold ||
        pointer.x > strip.right + threshold
    );
}
