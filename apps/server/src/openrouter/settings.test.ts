import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import { AgentRuntimeRequestError } from '../agent-runtime/client.ts';
import * as configuredClient from '../agent-runtime/configured-client.ts';
import * as tavernVault from '../storage/tavern-vault.ts';
import { getOpenRouterSettings } from './settings.ts';

afterEach(() => {
    mock.restore();
});

test('getOpenRouterSettings falls back to Tavern Vault when Runtime settings are temporarily unavailable', async () => {
    let closed = false;
    spyOn(configuredClient, 'createConfiguredAgentRuntimeClient').mockReturnValue({
        close() {
            closed = true;
        },
        async getOpenRouterSettings() {
            throw new AgentRuntimeRequestError({
                code: 'control_plane_request_failed',
                message: 'Runtime request failed with status 502.',
                retryable: true,
                status: 502,
            });
        },
    } as unknown as ReturnType<typeof configuredClient.createConfiguredAgentRuntimeClient>);
    spyOn(tavernVault, 'getTavernVaultSecret').mockResolvedValue({
        secret: {
            apiKey: 'sk-openrouter',
            managementApiKey: 'mgmt-openrouter',
        },
        updatedAt: '2026-06-06T00:00:00.000Z',
    });

    const settings = await getOpenRouterSettings();

    assert.equal(closed, true);
    assert.deepEqual(settings, {
        apiKey: 'sk-openrouter',
        hasApiKey: true,
        hasManagementApiKey: true,
        managementApiKey: 'mgmt-openrouter',
        updatedAt: '2026-06-06T00:00:00.000Z',
    });
});
