import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { agentRuntimeMutationHeaders, agentRuntimeMutationOrigins } from '@tavern/api';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import {
    getModelCapabilitySelections,
    handleModelCapabilitySelectionsRequest,
    imageGenerationReadiness,
    resolveImageGenerationSelection,
    saveModelCapabilitySelections,
} from './capability-selections.ts';

const imageModel = { model: 'gpt-image-2', provider: 'openai' };

describe('model capability selections', () => {
    let codexHome: string;

    beforeEach(async () => {
        ensureRuntimeSchema(initTestDb());
        codexHome = await fs.mkdtemp(path.join(tmpdir(), 'tavern-codex-readiness-'));
        vi.stubEnv('CODEX_HOME', codexHome);
    });

    afterEach(async () => {
        closeDb();
        vi.unstubAllEnvs();
        await fs.rm(codexHome, { force: true, recursive: true });
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

    test('reports a selected Codex image model ready with vault credentials', () => {
        saveModelCapabilitySelections({
            selections: { imageGeneration: { model: 'gpt-image-2', provider: 'codex' } },
        });
        const now = new Date().toISOString();
        getDb()
            .prepare(
                `INSERT INTO tavern_vault_secrets (id, secret_json, created_at, updated_at)
                 VALUES (?, ?, ?, ?)`
            )
            .run(
                'model-access:codex',
                JSON.stringify({ accessToken: 'codex-access-token' }),
                now,
                now
            );

        expect(imageGenerationReadiness()).toEqual({
            model: { model: 'gpt-image-2', provider: 'codex' },
            ready: true,
        });
    });

    test('reports a selected Codex image model unready without credentials', () => {
        saveModelCapabilitySelections({
            selections: { imageGeneration: { model: 'gpt-image-2', provider: 'codex' } },
        });

        expect(imageGenerationReadiness()).toEqual({
            ready: false,
            reason: 'Connect Codex in Model access to use subscription image generation.',
        });
    });
});
