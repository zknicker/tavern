'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
    buildDevWindowUrl,
    findReattachTarget,
    isSafeWindowRoute,
    nextWindowBounds,
    pointOverWindowStrip,
} = require('./window-routing.cjs');

test('isSafeWindowRoute only accepts in-app dashboard routes', () => {
    assert.equal(isSafeWindowRoute('/dashboard/chats/abc'), true);
    assert.equal(isSafeWindowRoute('/dashboard/new/key'), true);
    assert.equal(isSafeWindowRoute('/settings'), false);
    assert.equal(isSafeWindowRoute('https://evil.example'), false);
    assert.equal(isSafeWindowRoute(undefined), false);
    assert.equal(isSafeWindowRoute(42), false);
});

test('nextWindowBounds centers the first window and offsets the rest', () => {
    assert.deepEqual(nextWindowBounds(undefined), {
        width: 1440,
        height: 960,
        x: undefined,
        y: undefined,
    });

    assert.deepEqual(nextWindowBounds({ x: 100, y: 80, width: 1200, height: 800 }, { offset: 36 }), {
        width: 1200,
        height: 800,
        x: 136,
        y: 116,
    });
});

test('buildDevWindowUrl seeds the dev server path route', () => {
    assert.equal(
        buildDevWindowUrl('http://localhost:3100', '/dashboard/chats/abc'),
        'http://localhost:3100/dashboard/chats/abc'
    );
    assert.equal(buildDevWindowUrl('http://localhost:3100', undefined), 'http://localhost:3100');
});

test('pointOverWindowStrip detects the top strip band only', () => {
    const bounds = { x: 100, y: 200, width: 1000, height: 800 };
    assert.equal(pointOverWindowStrip(bounds, { x: 500, y: 210 }, 46), true);
    assert.equal(pointOverWindowStrip(bounds, { x: 500, y: 400 }, 46), false); // below strip
    assert.equal(pointOverWindowStrip(bounds, { x: 50, y: 210 }, 46), false); // left of window
});

test('findReattachTarget returns the strip under the cursor, skipping the torn window', () => {
    const windows = [
        { id: 1, bounds: { x: 0, y: 0, width: 800, height: 600 } },
        { id: 2, bounds: { x: 900, y: 0, width: 800, height: 600 } },
    ];

    // Cursor over window 2's strip, while window 2 is the one being dragged → no target.
    assert.equal(findReattachTarget(windows, { x: 950, y: 10 }, 2, 46), null);
    // Cursor over window 1's strip while dragging window 2 → re-attach to 1.
    assert.equal(findReattachTarget(windows, { x: 100, y: 10 }, 2, 46), 1);
    // Cursor in open space → no target.
    assert.equal(findReattachTarget(windows, { x: 100, y: 400 }, 2, 46), null);
});
