import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const script = readFileSync(new URL('./build-tauri-sidecar.mjs', import.meta.url), 'utf8');

test('sidecar cache includes the desktop app package version', () => {
    assert.match(script, /apps\/website\/package\.json/);
});
