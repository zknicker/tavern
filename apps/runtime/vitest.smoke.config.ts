import { defineConfig } from 'vitest/config';
import { markdownAsText } from './vitest.config.ts';

export default defineConfig({
    plugins: [markdownAsText()],
    test: {
        include: ['src/**/*.smoke.ts'],
        // Real harness turns spawn a provider CLI and wait on a live model.
        testTimeout: 240_000,
    },
});
