import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import * as tavernVault from '../storage/tavern-vault.ts';
import * as usageSourceSettings from '../storage/usage-source-settings.ts';
import { getOpenRouterSettings } from './settings.ts';

afterEach(() => {
    mock.restore();
});

test('getOpenRouterSettings reads the OpenRouter stats management key', async () => {
    spyOn(usageSourceSettings, 'getUsageSourceSettings').mockResolvedValue({
        settings: {
            managementApiKey: 'mgmt-openrouter',
        },
        updatedAt: '2026-06-06T00:00:00.000Z',
    });

    const settings = await getOpenRouterSettings();

    assert.deepEqual(settings, {
        apiKey: '',
        hasApiKey: false,
        hasManagementApiKey: true,
        managementApiKey: 'mgmt-openrouter',
        updatedAt: '2026-06-06T00:00:00.000Z',
    });
});

test('getOpenRouterSettings migrates a legacy OpenRouter management key from Tavern Vault', async () => {
    spyOn(usageSourceSettings, 'getUsageSourceSettings').mockResolvedValue(null);
    const saveSettings = spyOn(usageSourceSettings, 'saveUsageSourceSettings').mockResolvedValue({
        updatedAt: '2026-06-09T00:00:00.000Z',
    });
    spyOn(tavernVault, 'getTavernVaultSecret').mockResolvedValue({
        secret: {
            apiKey: 'old-openrouter-api-key',
            managementApiKey: ' old-openrouter-management-key ',
        },
        updatedAt: '2026-06-08T00:00:00.000Z',
    });
    const deleteLegacy = spyOn(tavernVault, 'deleteTavernVaultSecret').mockResolvedValue();

    const settings = await getOpenRouterSettings();

    assert.deepEqual(settings, {
        apiKey: '',
        hasApiKey: false,
        hasManagementApiKey: true,
        managementApiKey: 'old-openrouter-management-key',
        updatedAt: '2026-06-09T00:00:00.000Z',
    });
    assert.equal(saveSettings.mock.calls.length, 1);
    assert.deepEqual(saveSettings.mock.calls[0]?.[0], {
        id: usageSourceSettings.usageSourceSettingIds.openRouter,
        settings: {
            managementApiKey: 'old-openrouter-management-key',
        },
    });
    assert.deepEqual(
        deleteLegacy.mock.calls[0]?.[0],
        tavernVault.tavernVaultSecretIds.openRouterSettings
    );
});
