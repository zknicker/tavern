import assert from 'node:assert/strict';
import test from 'node:test';
import { joinArgs, splitArgs, toEnvRecord } from './mcp-server-shared.ts';

test('splitArgs splits on whitespace and drops empty parts', () => {
    assert.deepEqual(splitArgs('  serve  --port 8080 '), ['serve', '--port', '8080']);
});

test('splitArgs returns an empty list for blank input', () => {
    assert.deepEqual(splitArgs('   '), []);
});

test('joinArgs joins args with single spaces', () => {
    assert.equal(joinArgs(['serve', '--port', '8080']), 'serve --port 8080');
});

test('toEnvRecord trims names and drops empty names', () => {
    assert.deepEqual(
        toEnvRecord([
            { name: '  TOKEN  ', value: 'abc' },
            { name: '   ', value: 'ignored' },
        ]),
        { TOKEN: 'abc' }
    );
});

test('toEnvRecord keeps blank values for named entries', () => {
    assert.deepEqual(toEnvRecord([{ name: 'NEW', value: '' }]), { NEW: '' });
});
