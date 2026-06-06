import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import { AgentRuntimeRequestError } from '../agent-runtime/client.ts';
import * as configuredClient from '../agent-runtime/configured-client.ts';
import { getOpenAiSettings } from './settings.ts';

afterEach(() => {
    mock.restore();
});

test('getOpenAiSettings returns null when Runtime settings are temporarily unavailable', async () => {
    let closed = false;
    spyOn(configuredClient, 'createConfiguredAgentRuntimeClient').mockReturnValue({
        close() {
            closed = true;
        },
        async getOpenAiSettings() {
            throw new AgentRuntimeRequestError({
                code: 'control_plane_request_failed',
                message: 'Runtime request failed with status 502.',
                retryable: true,
                status: 502,
            });
        },
    } as unknown as ReturnType<typeof configuredClient.createConfiguredAgentRuntimeClient>);

    const settings = await getOpenAiSettings();

    assert.equal(closed, true);
    assert.equal(settings, null);
});
