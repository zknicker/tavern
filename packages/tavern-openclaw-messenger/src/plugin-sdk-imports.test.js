import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const sourceDir = import.meta.dirname;
const blockedImports = [
    'openclaw/plugin-sdk/outbound-runtime',
    'api.registerHook',
    'registerHook(',
];

describe('Tavern Messenger Plugin SDK imports', () => {
    test('does not use deprecated production SDK surfaces', () => {
        const violations = [];

        for (const filename of readdirSync(sourceDir)) {
            if (!(filename.endsWith('.js') && !filename.endsWith('.test.js'))) {
                continue;
            }

            const source = readFileSync(join(sourceDir, filename), 'utf8');

            for (const blocked of blockedImports) {
                if (source.includes(blocked)) {
                    violations.push(`${basename(filename)}: ${blocked}`);
                }
            }
        }

        expect(violations).toEqual([]);
    });
});
