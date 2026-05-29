import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const directory = mkdtempSync(join(tmpdir(), 'tavern-agent-profiles-storage-'));
const databasePath = join(directory, 'test.sqlite');

process.env.DATABASE_PATH = databasePath;

const [{ ensureDatabaseSchema }, agentStorage, { databaseClient }] = await Promise.all([
    import('../db/bootstrap.ts'),
    import('./agent-profiles.ts'),
    import('../db/index.ts'),
]);

ensureDatabaseSchema();

test.beforeEach(() => {
    for (const table of [
        'session_deliveries',
        'session_links',
        'session_message_parts',
        'session_messages',
        'session_runs',
        'cron_runs',
        'messaging_bindings',
        'agent_thought_snapshots',
        'agent_profiles',
    ]) {
        databaseClient.exec(`delete from ${table}`);
    }
});

test('saveAgentProfile preserves independent profile fields on partial update', async () => {
    await agentStorage.saveAgentProfile({
        agentId: 'planner',
        primaryColor: '#14b8a6',
        runtimeId: 'runtime-main',
        userInstructions: 'Use terse planning.',
    });

    const colorOnly = await agentStorage.saveAgentProfile({
        agentId: 'planner',
        primaryColor: '#0ea5e9',
        runtimeId: 'runtime-main',
    });

    assert.equal(colorOnly?.primaryColor, '#0ea5e9');
    assert.equal(colorOnly?.userInstructions, 'Use terse planning.');

    const instructionsOnly = await agentStorage.saveAgentProfile({
        agentId: 'planner',
        runtimeId: 'runtime-main',
        userInstructions: 'Prefer direct answers.',
    });

    assert.equal(instructionsOnly?.primaryColor, '#0ea5e9');
    assert.equal(instructionsOnly?.userInstructions, 'Prefer direct answers.');
});

test('deleteAgentProfile removes app-side rows owned by the deleted agent', async () => {
    const now = new Date().toISOString();
    const agentId = 'planner';

    await agentStorage.saveAgentProfile({
        agentId,
        primaryColor: '#14b8a6',
        runtimeId: 'runtime-main',
    });
    databaseClient
        .query(
            `insert into session_runs (id, session_key, session_id, agent_id, updated_at, payload_json)
             values (?, ?, ?, ?, ?, ?)`
        )
        .run('run-planner', 'session:planner', 'runtime-session-planner', agentId, now, '{}');
    databaseClient
        .query(
            `insert into session_messages (id, session_key, role, raw_json, synced_at)
             values (?, ?, ?, ?, ?)`
        )
        .run('message-planner', 'session:planner', 'assistant', '{}', now);
    databaseClient
        .query(
            `insert into session_message_parts (id, session_key, message_id, part_index, type, raw_json, synced_at)
             values (?, ?, ?, ?, ?, ?, ?)`
        )
        .run('part-planner', 'session:planner', 'message-planner', 0, 'text', '{}', now);
    databaseClient
        .query(
            `insert into session_links (id, parent_session_key, child_session_key, link_type, created_at, updated_at)
             values (?, ?, ?, ?, ?, ?)`
        )
        .run('link-planner', 'session:planner', 'session:child', 'session_child', now, now);
    databaseClient
        .query(
            `insert into session_deliveries (id, parent_session_key, child_session_key, created_at, updated_at)
             values (?, ?, ?, ?, ?)`
        )
        .run('delivery-planner', 'session:parent', 'session:planner', now, now);
    databaseClient
        .query(
            `insert into cron_runs (session_key, job_id, session_id, agent_id, run_at, synced_at)
             values (?, ?, ?, ?, ?, ?)`
        )
        .run('cron-planner', 'job-planner', 'session-cron', agentId, now, now);
    databaseClient
        .query(
            `insert into messaging_bindings (
                id, platform, name, token, enabled, metadata_json, agent_id, inbound_mode,
                match_json, created_at, updated_at
             )
             values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
            'binding-planner',
            'discord',
            'Planner',
            'token',
            'true',
            '{}',
            agentId,
            'active',
            '{}',
            now,
            now
        );
    databaseClient
        .query(
            `insert into agent_thought_snapshots (
                id, agent_id, generated_at, model, prompt_markdown, session_keys_json,
                snapshot_hour, thoughts_markdown, window_end_at, window_start_at
             )
             values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run('thought-planner', agentId, now, 'model', '', '[]', now, '', now, now);

    await agentStorage.deleteAgentProfile({
        agentId,
        runtimeId: 'runtime-main',
    });

    for (const table of [
        'agent_profiles',
        'agent_thought_snapshots',
        'cron_runs',
        'messaging_bindings',
        'session_deliveries',
        'session_links',
        'session_message_parts',
        'session_messages',
        'session_runs',
    ]) {
        const row = databaseClient.query(`select count(*) as count from ${table}`).get() as {
            count: number;
        };
        assert.equal(row.count, 0, table);
    }
});
