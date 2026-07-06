import { describe, expect, test } from 'bun:test';
import type { MerchbaseSettingsOutput } from '../../../lib/trpc.tsx';
import {
    createDraft,
    hasDraftChanges,
    normalizeDraft,
    toSaveInput,
} from './merchbase-settings-model.ts';

const savedSettings = {
    apiKey: 'secret-key',
    apiKeyConfigured: true,
    baseUrl: 'https://app.merchbase.co',
    defaultAccount: 'acct_123',
    defaultMarketplace: 'US',
    enabled: true,
    enablementSource: 'settings',
    skillConflict: null,
    updatedAt: '2026-07-06T20:00:00.000Z',
} satisfies NonNullable<MerchbaseSettingsOutput>;

describe('MerchBase settings model', () => {
    test('loads the saved API key into the editable draft', () => {
        expect(createDraft(savedSettings).apiKey).toBe('secret-key');
    });

    test('does not dirty or resend an unchanged revealed API key', () => {
        const draft = normalizeDraft(createDraft(savedSettings));

        expect(hasDraftChanges(savedSettings, draft)).toBe(false);
        expect(toSaveInput(savedSettings, draft)).toMatchObject({
            apiKey: undefined,
            enabled: true,
        });
    });

    test('sends null when a saved API key is cleared', () => {
        const draft = normalizeDraft({ ...createDraft(savedSettings), apiKey: '', enabled: false });

        expect(hasDraftChanges(savedSettings, draft)).toBe(true);
        expect(toSaveInput(savedSettings, draft)).toMatchObject({
            apiKey: null,
            enabled: false,
        });
    });
});
