import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { createImageModelForRuntime, supportsImageModelForRuntime } from './image-model.ts';

describe('image model', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
        vi.stubEnv('OPENAI_API_KEY', '');
        vi.stubEnv('TAVERN_AGENT_API_KEY', '');
    });

    afterEach(() => {
        closeDb();
        vi.unstubAllEnvs();
    });

    test('rejects providers without a direct image adapter', () => {
        const model = { model: 'example-image', provider: 'custom' } as const;

        expect(supportsImageModelForRuntime(model)).toBe(false);
        expect(() => createImageModelForRuntime(model)).toThrow(
            'Image generation cannot use provider "custom" without a direct image model adapter.'
        );
    });

    test('requires an OpenAI key', () => {
        expect(() =>
            createImageModelForRuntime({ model: 'gpt-image-2', provider: 'openai' })
        ).toThrow('OPENAI_API_KEY or TAVERN_AGENT_API_KEY is required for image generation.');
    });

    test('creates an OpenAI image model without making a request', () => {
        vi.stubEnv('OPENAI_API_KEY', 'sk-test');

        const model = createImageModelForRuntime({ model: 'gpt-image-2', provider: 'openai' });

        expect(model).toMatchObject({ modelId: 'gpt-image-2' });
    });
});
