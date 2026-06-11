import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getCronEditorErrorMessage,
    getCronEditorFormKey,
    getCronEditorSubmitErrorMessage,
} from './use-cron-editor-form.ts';

function createJob(
    overrides?: Partial<{
        createdAt: string;
        deleteAfterRun: boolean;
        delivery: { chatId: string } | null;
        description: string;
        enabled: boolean;
        name: string;
        updatedAt: string;
    }>
) {
    return {
        agentId: 'agent:claw',
        createdAt: overrides?.createdAt ?? '2026-04-18T19:00:00.000Z',
        deleteAfterRun: overrides?.deleteAfterRun ?? false,
        delivery: overrides?.delivery ?? {
            chatId: 'portal:chat',
        },
        description: overrides?.description ?? 'Post a scheduled joke.',
        enabled: overrides?.enabled ?? true,
        id: 'cron-1',
        managed: false,
        name: overrides?.name ?? 'Portal Joke',
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
        syncedAt: overrides?.updatedAt ?? '2026-04-18T19:00:00.000Z',
        updatedAt: overrides?.updatedAt ?? '2026-04-18T19:00:00.000Z',
        wakeMode: 'now' as const,
    };
}

test('getCronEditorErrorMessage prefers explicit error messages', () => {
    assert.equal(getCronEditorErrorMessage(new Error('Name is required.')), 'Name is required.');
    assert.equal(
        getCronEditorErrorMessage({ message: 'Cron expression is required.' }),
        'Cron expression is required.'
    );
    assert.equal(
        getCronEditorErrorMessage('Interval must be a positive number of milliseconds.'),
        'Interval must be a positive number of milliseconds.'
    );
});

test('getCronEditorErrorMessage falls back to a generic save error', () => {
    assert.equal(getCronEditorErrorMessage('   '), 'Unable to save automation.');
    assert.equal(getCronEditorErrorMessage({}), 'Unable to save automation.');
    assert.equal(getCronEditorErrorMessage(null), 'Unable to save automation.');
});

test('getCronEditorSubmitErrorMessage only returns form-level string errors', () => {
    assert.equal(getCronEditorSubmitErrorMessage('Name is required.'), 'Name is required.');
    assert.equal(
        getCronEditorSubmitErrorMessage({
            fields: {},
            form: 'Cron expression is required.',
        }),
        'Cron expression is required.'
    );
    assert.equal(getCronEditorSubmitErrorMessage('   '), null);
    assert.equal(getCronEditorSubmitErrorMessage(new Error('Name is required.')), null);
});

test('getCronEditorFormKey uses a dedicated create key for new cron forms', () => {
    assert.equal(getCronEditorFormKey(null, 'claw'), 'create:claw');
});

test('getCronEditorFormKey follows the form-facing cron snapshot', () => {
    const job = createJob({
        updatedAt: '2026-04-18T20:00:00.000Z',
    });

    assert.match(getCronEditorFormKey(job), /^\{.*"deliveryChatId":"portal:chat".*\}$/);
});

test('getCronEditorFormKey changes when a form-facing cron field changes', () => {
    const staleJob = createJob({
        delivery: {
            chatId: 'tavern:stale-chat',
        },
    });
    const freshJob = createJob({
        delivery: {
            chatId: 'portal:chat',
        },
    });

    assert.notEqual(getCronEditorFormKey(staleJob), getCronEditorFormKey(freshJob));
});
