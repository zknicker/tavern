import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldRenderCronEditorPageForm } from './cron-editor.tsx';

function createJob() {
    return {
        agentId: 'agent:claw',
        createdAt: '2026-04-18T19:00:00.000Z',
        deleteAfterRun: false,
        delivery: {
            chatId: 'portal:chat',
        },
        description: 'Post a scheduled joke.',
        enabled: true,
        id: 'cron-1',
        mode: 'agentTurn' as const,
        name: 'Portal Joke',
        payload: {
            kind: 'agentTurn' as const,
            message: 'Tell a joke.',
        },
        schedule: {
            expr: '0 * * * *',
            kind: 'cron' as const,
            tz: 'America/New_York',
        },
        state: {},
        syncedAt: '2026-04-18T19:00:00.000Z',
        updatedAt: '2026-04-18T19:00:00.000Z',
    };
}

test('shouldRenderCronEditorPageForm waits for the edit job before mounting the page form', () => {
    assert.equal(
        shouldRenderCronEditorPageForm({
            isLoading: true,
            isNew: false,
            job: null,
        }),
        false
    );
    assert.equal(
        shouldRenderCronEditorPageForm({
            isLoading: false,
            isNew: false,
            job: null,
        }),
        true
    );
    assert.equal(
        shouldRenderCronEditorPageForm({
            isLoading: true,
            isNew: false,
            job: createJob(),
        }),
        true
    );
    assert.equal(
        shouldRenderCronEditorPageForm({
            isLoading: true,
            isNew: true,
            job: null,
        }),
        true
    );
});
