import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { formatPortBlockers } from './dev-stack-shared.mjs';

test('formatPortBlockers includes owner process details', () => {
    const repositoryRoot = path.join('/Users', 'zknicker', 'repo');
    const message = formatPortBlockers(
        [
            {
                command: 'bun --watch src/index.ts',
                cwd: path.join('/Users', 'zknicker', 'repo', 'apps', 'runtime'),
                label: 'runtime',
                pid: 1234,
                port: 4310,
            },
        ],
        repositoryRoot
    );

    assert.match(message, /Required dev port unavailable/u);
    assert.match(message, /runtime port 4310 is already in use by PID 1234/u);
    assert.match(message, /bun --watch src\/index\.ts/u);
    assert.match(message, /\.\/apps\/runtime/u);
});
