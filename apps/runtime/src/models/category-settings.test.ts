import { agentRuntimeMutationHeaders, agentRuntimeMutationOrigins } from '@tavern/api';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import {
    getModelCategorySettings,
    handleModelCategorySettingsRequest,
    resolveModelCategorySelection,
} from './category-settings.ts';
import { defaultAgentModelSelection } from './selection-service.ts';

describe('model category settings', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    test('defaults model categories to automatic', async () => {
        expect(getModelCategorySettings()).toMatchObject({
            categories: {
                deep: null,
                fast: null,
                standard: null,
                visual: null,
            },
            updatedAt: null,
        });

        expect(resolveModelCategorySelection('fast')).toEqual(defaultAgentModelSelection());
    });

    test('saves partial category overrides', async () => {
        const response = await handleModelCategorySettingsRequest(
            new Request('http://runtime.test/model-categories/settings', {
                body: JSON.stringify({
                    categories: {
                        fast: { model: 'gpt-4.1-mini', provider: 'openai' },
                        standard: { model: 'claude-sonnet-4', provider: 'claude' },
                    },
                }),
                headers: {
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'PUT',
            })
        );

        await expect(response?.json()).resolves.toMatchObject({
            categories: {
                deep: null,
                fast: { model: 'gpt-4.1-mini', provider: 'openai' },
                standard: { model: 'claude-sonnet-4', provider: 'claude' },
                visual: null,
            },
            restartScheduled: false,
        });
        expect(resolveModelCategorySelection('standard')).toEqual({
            model: 'claude-sonnet-4',
            provider: 'claude',
        });
    });

    test('rejects non-Tavern category setting writes', async () => {
        const response = await handleModelCategorySettingsRequest(
            new Request('http://runtime.test/model-categories/settings', {
                body: JSON.stringify({
                    categories: {
                        fast: { model: 'gpt-4.1-mini', provider: 'openai' },
                    },
                }),
                headers: { 'content-type': 'application/json' },
                method: 'PUT',
            })
        );

        expect(response?.status).toBe(403);
        expect(getModelCategorySettings().categories.fast).toBeNull();
    });
});
