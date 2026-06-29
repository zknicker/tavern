'use strict';

// Pure helpers for multi-window routing/placement. Kept free of electron imports so
// they can be unit-tested without launching the app.

const dashboardRoutePrefix = '/dashboard/';
const defaultWindowWidth = 1440;
const defaultWindowHeight = 960;
const defaultWindowOffsetPx = 36;
// Re-attach target band: the tab strip lives in the top of each window.
const windowStripHeightPx = 46;

/** Only same-origin app routes may seed a new window. */
function isSafeWindowRoute(route) {
    return typeof route === 'string' && route.startsWith(dashboardRoutePrefix);
}

/** Offsets each new window from its opener (or screen-centered default) so they don't stack. */
function nextWindowBounds(openerBounds, options = {}) {
    const offset = options.offset ?? defaultWindowOffsetPx;
    const width = options.width ?? defaultWindowWidth;
    const height = options.height ?? defaultWindowHeight;

    if (!openerBounds) {
        return { width, height, x: undefined, y: undefined };
    }

    return {
        width: openerBounds.width,
        height: openerBounds.height,
        x: openerBounds.x + offset,
        y: openerBounds.y + offset,
    };
}

/** Builds the dev-server URL (path router) for a seeded route, or the bare origin. */
function buildDevWindowUrl(devUrl, route) {
    return route ? new URL(route, devUrl).toString() : devUrl;
}

/** True when a screen point sits over a window's tab strip (its re-attach drop zone). */
function pointOverWindowStrip(bounds, point, stripHeight = windowStripHeightPx) {
    return (
        point.x >= bounds.x &&
        point.x <= bounds.x + bounds.width &&
        point.y >= bounds.y &&
        point.y <= bounds.y + stripHeight
    );
}

/**
 * The id of the window whose tab strip is under `point` — the re-attach target while
 * tearing a tab out. The torn-off (following) window is excluded via `excludeId`.
 */
function findReattachTarget(windowBounds, point, excludeId, stripHeight = windowStripHeightPx) {
    for (const entry of windowBounds) {
        if (entry.id !== excludeId && pointOverWindowStrip(entry.bounds, point, stripHeight)) {
            return entry.id;
        }
    }

    return null;
}

module.exports = {
    buildDevWindowUrl,
    findReattachTarget,
    isSafeWindowRoute,
    nextWindowBounds,
    pointOverWindowStrip,
    windowStripHeightPx,
};
