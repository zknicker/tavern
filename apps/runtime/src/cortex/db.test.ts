import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { defaultCortexDatabasePath, resolveCortexDatabasePath } from './db';

describe('Cortex database path', () => {
    const originalPath = process.env.TAVERN_CORTEX_DATABASE_PATH;

    afterEach(() => {
        process.env.TAVERN_CORTEX_DATABASE_PATH = originalPath;
    });

    test('uses the default runtime path without configuration', () => {
        process.env.TAVERN_CORTEX_DATABASE_PATH = undefined;

        expect(resolveCortexDatabasePath()).toBe(defaultCortexDatabasePath);
    });

    test('honors configured Cortex database path', () => {
        process.env.TAVERN_CORTEX_DATABASE_PATH = 'tmp/custom-cortex.pglite';

        expect(resolveCortexDatabasePath()).toBe(path.resolve('tmp/custom-cortex.pglite'));
    });
});
