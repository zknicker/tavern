import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/**/*.smoke.ts'],
        // Real harness turns spawn a provider CLI and wait on a live model.
        testTimeout: 240_000,
    },
});
