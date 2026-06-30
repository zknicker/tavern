/**
 * Browser-shell tab geometry. Every tab/shell path derives from these constants,
 * so the active-tab fill, the continuous shell hairline, and the shell-top corners
 * all stay in lock-step. Tab width is a runtime input (tabs can be dynamic-width):
 * pass the rendered body width into the path builders below.
 */

export const TAB_H = 34; // tab height
export const FOOT = 16; // outward concave "foot" radius that flares into the toolbar
export const TOP_R = 9; // tab top-corner radius
export const CARD_R = 16; // shell content-card top-corner radius (matches the tab FOOT)

/** Default tab body width. Provider may feed a per-tab width instead. */
export const TAB_W = 200;

/** Live-measured geometry the active-tab/shell hairline is traced from. */
export interface OutlineGeometry {
    /** y of the strip/toolbar boundary, relative to the shell top */
    boundaryY: number;
    /** active tab left edge, relative to the shell left */
    tabLeft: number;
    /** active tab right edge, relative to the shell left */
    tabRight: number;
    /** shell content width */
    w: number;
}

/**
 * The active tab's silhouette (rounded top + the two concave "feet") as a single
 * path string, for a tab body `width`. The shell's continuous hairline re-uses the
 * same geometry so fill and stroke can never drift apart.
 */
export function buildTabOutlinePath(width: number): string {
    const svgW = width + FOOT * 2; // full silhouette incl. both feet
    const rx = FOOT + width; // tab body's right edge, in svg coords

    return (
        `M0 ${TAB_H} A${FOOT} ${FOOT} 0 0 0 ${FOOT} ${TAB_H - FOOT}` +
        ` L${FOOT} ${TOP_R} A${TOP_R} ${TOP_R} 0 0 1 ${FOOT + TOP_R} 0` +
        ` L${rx - TOP_R} 0 A${TOP_R} ${TOP_R} 0 0 1 ${rx} ${TOP_R}` +
        ` L${rx} ${TAB_H - FOOT} A${FOOT} ${FOOT} 0 0 0 ${svgW} ${TAB_H}`
    );
}

/**
 * The single hairline for the whole shell top: the card's rounded top-left corner →
 * along the strip/toolbar boundary → up-and-around the active tab (both feet, sides,
 * rounded top) → back along the boundary → rounded top-right corner. Drawn as ONE
 * stroked path over the live-measured active tab, so the tab outline and the shell's
 * top edge are literally the same line — no fork, no seam.
 */
export function buildShellOutlinePath({
    w,
    boundaryY,
    tabLeft,
    tabRight,
}: OutlineGeometry): string {
    const tabTop = boundaryY - TAB_H;
    const lfo = tabLeft - FOOT; // left foot, outer edge
    const rfo = tabRight + FOOT; // right foot, outer edge

    return (
        `M0 ${boundaryY + CARD_R} A${CARD_R} ${CARD_R} 0 0 1 ${CARD_R} ${boundaryY}` +
        ` L${lfo} ${boundaryY}` +
        ` A${FOOT} ${FOOT} 0 0 0 ${tabLeft} ${boundaryY - FOOT}` +
        ` L${tabLeft} ${tabTop + TOP_R}` +
        ` A${TOP_R} ${TOP_R} 0 0 1 ${tabLeft + TOP_R} ${tabTop}` +
        ` L${tabRight - TOP_R} ${tabTop}` +
        ` A${TOP_R} ${TOP_R} 0 0 1 ${tabRight} ${tabTop + TOP_R}` +
        ` L${tabRight} ${boundaryY - FOOT}` +
        ` A${FOOT} ${FOOT} 0 0 0 ${rfo} ${boundaryY}` +
        ` L${w - CARD_R} ${boundaryY}` +
        ` A${CARD_R} ${CARD_R} 0 0 1 ${w} ${boundaryY + CARD_R}`
    );
}
