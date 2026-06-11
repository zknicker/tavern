import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeDefined } from './merge-defined.ts';

test('merges defined patch keys over the base', () => {
    assert.deepEqual(mergeDefined({ a: 1, b: 'x' }, { b: 'y' }), { a: 1, b: 'y' });
});

test('ignores keys explicitly set to undefined', () => {
    assert.deepEqual(mergeDefined({ a: 1, b: 'x' }, { b: undefined }), { a: 1, b: 'x' });
});

test('keeps null as a real value', () => {
    assert.deepEqual(mergeDefined<{ a: null | number }>({ a: 1 }, { a: null }), { a: null });
});

test('returns a new object and leaves the base untouched', () => {
    const base = { a: 1 };
    const next = mergeDefined(base, { a: 2 });
    assert.notEqual(next, base);
    assert.equal(base.a, 1);
});
