import { describe, expect, test } from 'bun:test';
import { configureQmdRuntimeEnvironment } from './qmd-loader.ts';

describe('configureQmdRuntimeEnvironment', () => {
    test('disables Metal residency before QMD loads on macOS', () => {
        const env: NodeJS.ProcessEnv = {};

        configureQmdRuntimeEnvironment('darwin', env);

        expect(env.GGML_METAL_NO_RESIDENCY).toBe('1');
    });

    test('preserves explicit residency settings', () => {
        const disabled: NodeJS.ProcessEnv = { GGML_METAL_NO_RESIDENCY: '0' };
        const optedIn: NodeJS.ProcessEnv = { QMD_METAL_KEEP_RESIDENCY: '1' };

        configureQmdRuntimeEnvironment('darwin', disabled);
        configureQmdRuntimeEnvironment('darwin', optedIn);

        expect(disabled.GGML_METAL_NO_RESIDENCY).toBe('0');
        expect(optedIn.GGML_METAL_NO_RESIDENCY).toBeUndefined();
    });

    test('does not change non-macOS environments', () => {
        const env: NodeJS.ProcessEnv = {};

        configureQmdRuntimeEnvironment('linux', env);

        expect(env.GGML_METAL_NO_RESIDENCY).toBeUndefined();
    });
});
