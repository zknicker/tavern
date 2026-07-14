import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { saveModelCapabilitySelections } from '../models/capability-selections.ts';
import { getRuntimeTool, listRuntimeTools } from './tool-catalog.ts';

describe('Runtime tool catalog', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
        vi.stubEnv('OPENAI_API_KEY', '');
        vi.stubEnv('TAVERN_AGENT_API_KEY', '');
    });

    afterEach(() => {
        closeDb();
        vi.unstubAllEnvs();
    });

    test('lists the artifact pane tool group', () => {
        expect(getRuntimeTool('pane')).toMatchObject({
            configured: true,
            enabled: true,
            readOnly: false,
            tools: ['pane_open'],
        });
    });

    test('lists image generation as unavailable until its model and key are ready', () => {
        expect(getRuntimeTool('image_generation')).toMatchObject({
            configured: false,
            enabled: false,
            readOnly: false,
            tools: ['image_generate'],
        });

        vi.stubEnv('OPENAI_API_KEY', 'sk-test');
        saveModelCapabilitySelections({
            selections: { imageGeneration: { model: 'gpt-image-2', provider: 'openai' } },
        });

        expect(
            listRuntimeTools().tools.find((tool) => tool.id === 'image_generation')
        ).toMatchObject({
            configured: true,
            enabled: true,
            tools: ['image_generate'],
        });
    });
});
