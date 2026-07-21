'use strict';

// Pure helpers for multi-window routing/placement. Kept free of electron imports so
// they can be unit-tested without launching the app.

// Top-level in-app route prefixes (mirrors lib/app-routes.ts; this file is plain CJS and
// cannot import the TS source). Only routes under one of these may seed a new window.
const appRoutePrefixes = [
    '/overview',
    '/chats',
    '/tasks',
    '/workspace',
    '/wiki',
    '/settings',
    '/onboarding',
];
const defaultWindowWidth = 1440;
const defaultWindowHeight = 960;
const defaultWindowOffsetPx = 36;

/** Only same-origin app routes may seed a new window. */
function isSafeWindowRoute(route) {
    return typeof route === 'string' && appRoutePrefixes.some((prefix) => route.startsWith(prefix));
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

module.exports = {
    buildDevWindowUrl,
    isSafeWindowRoute,
    nextWindowBounds,
};
