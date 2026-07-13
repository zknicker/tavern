import { agentRuntimeMutationHeaders, agentRuntimeMutationOrigins } from '@tavern/api';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import {
    getModelCapabilitySelections,
    handleModelCapabilitySelectionsRequest,
    resolveImageGenerationSelection,
    saveModelCapabilitySelections,
} from './capability-selections.ts';

const imageModel = { model: 'gpt-image-2', provider: 'openai' };

describe('model capability selections', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    test('defaults image generation to unset', () => {
        expect(getModelCapabilitySelections()).toEqual({
            selections: { imageGeneration: null },
            updatedAt: null,
        });
        expect(resolveImageGenerationSelection()).toBeNull();
    });

    test('saves and reads an image generation selection', () => {
        const saved = saveModelCapabilitySelections({
            selections: { imageGeneration: imageModel },
        });

        expect(saved.updatedAt).not.toBeNull();
        expect(new Date(saved.updatedAt ?? '').toISOString()).toBe(saved.updatedAt);
        expect(getModelCapabilitySelections()).toEqual(saved);
        expect(resolveImageGenerationSelection()).toEqual(imageModel);
    });

    test('merges partial saves with the current selections', () => {
        saveModelCapabilitySelections({
            selections: { imageGeneration: imageModel },
        });

        const saved = saveModelCapabilitySelections({ selections: {} });

        expect(saved.selections.imageGeneration).toEqual(imageModel);
    });

    test('requires Tavern mutation origin for request saves', async () => {
        const forbidden = await handleModelCapabilitySelectionsRequest(
            new Request('http://runtime.test/model-capabilities/selections', {
                body: JSON.stringify({ selections: { imageGeneration: imageModel } }),
                headers: { 'content-type': 'application/json' },
                method: 'PUT',
            })
        );
        expect(forbidden?.status).toBe(403);

        const response = await handleModelCapabilitySelectionsRequest(
            new Request('http://runtime.test/model-capabilities/selections', {
                body: JSON.stringify({ selections: { imageGeneration: imageModel } }),
                headers: {
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'PUT',
            })
        );

        expect(response?.status).toBe(200);
        await expect(response?.json()).resolves.toMatchObject({
            selections: { imageGeneration: imageModel },
        });
    });

    test('rejects invalid stored selections', () => {
        getDb()
            .prepare(
                `INSERT INTO runtime_metadata (key, value, updated_at)
                 VALUES (?, ?, ?)`
            )
            .run(
                'models:capability-selections',
                JSON.stringify({ selections: { imageGeneration: 'gpt-image-2' } }),
                new Date().toISOString()
            );

        expect(() => getModelCapabilitySelections()).toThrow(
            'Stored model capability selections are invalid; re-save them.'
        );
    });
});
