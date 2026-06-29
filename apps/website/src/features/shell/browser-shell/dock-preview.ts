/** Marks each rendered tab container so dock-drag math can read tab positions. */
export const SHELL_TAB_ATTR = 'data-shell-tab';

/**
 * Visual insertion index among the rendered tabs for a docked drag at window-x `x`
 * (CSS px from the window's left edge — the same space as the tabs' client rects).
 * Compares against each tab's *natural* center (subtracting any live dock-shift
 * transform) so sliding the gap open never moves the thresholds.
 */
export function computeDockInsertIndex(container: HTMLElement | null, x: number): number {
    if (!container) {
        return 0;
    }

    const tabs = container.querySelectorAll<HTMLElement>(`[${SHELL_TAB_ATTR}]`);
    let index = 0;

    for (const tab of tabs) {
        const rect = tab.getBoundingClientRect();
        const center = (rect.left + rect.right) / 2 - currentTranslateX(tab);

        if (x <= center) {
            break;
        }

        index += 1;
    }

    return index;
}

/** The element's current horizontal translate (px), so callers can recover the natural box. */
function currentTranslateX(el: HTMLElement): number {
    const { transform } = getComputedStyle(el);

    if (!transform || transform === 'none') {
        return 0;
    }

    const match = transform.match(/matrix(3d)?\(([^)]+)\)/u);

    if (!match) {
        return 0;
    }

    const values = match[2].split(',').map((value) => Number.parseFloat(value));

    return (match[1] ? values[12] : values[4]) || 0;
}
