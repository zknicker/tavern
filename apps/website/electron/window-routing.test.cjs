'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { buildDevWindowUrl, isSafeWindowRoute, nextWindowBounds } = require('./window-routing.cjs');

test('isSafeWindowRoute only accepts in-app routes', () => {
    assert.equal(isSafeWindowRoute('/chats/abc'), true);
    assert.equal(isSafeWindowRoute('/new/key'), true);
    assert.equal(isSafeWindowRoute('/settings'), true);
    assert.equal(isSafeWindowRoute('/dashboard/chats/abc'), false);
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

    assert.deepEqual(
        nextWindowBounds({ x: 100, y: 80, width: 1200, height: 800 }, { offset: 36 }),
        {
            width: 1200,
            height: 800,
            x: 136,
            y: 116,
        }
    );
});

test('buildDevWindowUrl seeds the dev server path route', () => {
    assert.equal(
        buildDevWindowUrl('http://localhost:3100', '/chats/abc'),
        'http://localhost:3100/chats/abc'
    );
    assert.equal(buildDevWindowUrl('http://localhost:3100', undefined), 'http://localhost:3100');
});
