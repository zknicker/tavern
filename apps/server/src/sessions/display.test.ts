import assert from 'node:assert/strict';
import test from 'node:test';
import { getSessionDisplay } from './display.ts';

test('getSessionDisplay keeps portal sources deterministic', () => {
    assert.deepEqual(
        getSessionDisplay({
            key: 'session:portal-1',
            source: 'portal:chat',
        }),
        {
            name: 'portal:chat',
            source: 'portal:chat',
            type: 'portal',
        }
    );
});
