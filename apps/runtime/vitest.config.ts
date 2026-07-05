import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        env: {
            // Keep tests out of the developer's real ~/.tavern runtime root.
            TAVERN_RUNTIME_ROOT: path.join(os.tmpdir(), 'tavern-runtime-vitest'),
        },
        include: ['src/**/*.test.ts'],
    },
});
