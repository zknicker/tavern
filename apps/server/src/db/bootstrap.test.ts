import { Database } from 'bun:sqlite';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { getTableName, isTable } from 'drizzle-orm';
import * as schemaTables from './schema.ts';

const directory = mkdtempSync(join(tmpdir(), 'tavern-db-bootstrap-'));
process.env.DATABASE_PATH = join(directory, 'bootstrap-test.sqlite');

async function withTempDatabase(run: (db: Database) => Promise<void> | void) {
    const directory = mkdtempSync(join(tmpdir(), 'tavern-db-'));
    const path = join(directory, 'test.sqlite');
    const db = new Database(path);

    try {
        await run(db);
    } finally {
        db.close();
        rmSync(directory, { force: true, recursive: true });
    }
}

function listTableColumns(db: Database, table: string) {
    return db.query(`PRAGMA table_info(${table});`).all() as Array<{ name: string }>;
}

function listSortedColumnNames(db: Database, table: string) {
    return listTableColumns(db, table)
        .map((column) => column.name)
        .sort((left, right) => left.localeCompare(right));
}

function listUserTables(db: Database) {
    return db
        .query(
            `SELECT name
             FROM sqlite_master
             WHERE type = 'table'
               AND name NOT LIKE 'sqlite_%'
             ORDER BY name;`
        )
        .all() as Array<{ name: string }>;
}

function listExpectedSchemaTables() {
    return Object.values(schemaTables)
        .filter((value) => isTable(value))
        .map((table) => getTableName(table as Parameters<typeof getTableName>[0]))
        .sort((left, right) => left.localeCompare(right));
}

async function runBootstrapAgainst(db: Database) {
    const originalExec = Database.prototype.exec;
    const originalQuery = Database.prototype.query;

    try {
        Database.prototype.exec = function exec(
            this: Database,
            sql: string,
            ...bindings: unknown[]
        ) {
            return Reflect.apply(originalExec as (...args: unknown[]) => unknown, db, [
                sql,
                ...bindings,
            ]);
        } as typeof Database.prototype.exec;
        Database.prototype.query = function query(
            this: Database,
            sql: string,
            ...bindings: unknown[]
        ) {
            return Reflect.apply(originalQuery as (...args: unknown[]) => unknown, db, [
                sql,
                ...bindings,
            ]);
        } as typeof Database.prototype.query;

        const { ensureDatabaseSchema } = await import('./bootstrap.ts');
        ensureDatabaseSchema();
    } finally {
        Database.prototype.exec = originalExec;
        Database.prototype.query = originalQuery;
    }
}

test('ensureDatabaseSchema creates the current Tavern schema without obsolete tables', async () => {
    await withTempDatabase(async (db) => {
        await runBootstrapAgainst(db);

        const tables = listUserTables(db);
        const actualTableNames: string[] = tables.map((table) => table.name);
        const expectedTableNames = listExpectedSchemaTables();

        assert.deepEqual(actualTableNames, expectedTableNames);
        assert.equal(actualTableNames.includes('channels'), false);
        assert.equal(actualTableNames.includes('agent_channels'), false);
        assert.equal(actualTableNames.includes('channels_sync_state'), false);
        assert.equal(actualTableNames.includes('agent_channels_sync_state'), false);
        assert.equal(actualTableNames.includes('chat_projection_sync_state'), false);
        assert.equal(actualTableNames.includes('cron_job_runs'), false);
        assert.equal(actualTableNames.includes('chats'), false);
        assert.equal(actualTableNames.includes('observed_chats'), false);
        assert.equal(actualTableNames.includes('agent_chat_bindings'), false);
        assert.equal(actualTableNames.includes('agents'), true);
        assert.equal(actualTableNames.includes('chat_sessions'), false);
        assert.equal(actualTableNames.includes('chat_participants'), false);
        assert.equal(actualTableNames.includes('chat_push_state'), false);
        assert.equal(actualTableNames.includes('chats_sync_state'), false);
        assert.equal(actualTableNames.includes('observed_sessions'), false);
        assert.equal(actualTableNames.includes('observed_session_messages'), false);
        assert.equal(actualTableNames.includes('session_sync_state'), false);

        assert.deepEqual(
            listSortedColumnNames(db, 'agent_profiles'),
            [
                'agent_id',
                'avatar_character',
                'created_at',
                'primary_color',
                'runtime_id',
                'updated_at',
                'user_instructions',
            ].sort((left, right) => left.localeCompare(right))
        );
        assert.deepEqual(
            listSortedColumnNames(db, 'agents'),
            [
                'created_at',
                'enabled_skill_ids_json',
                'id',
                'last_synced_at',
                'name',
                'primary_color',
                'raw_json',
                'runtime_id',
                'updated_at',
                'workspace_folder',
            ].sort((left, right) => left.localeCompare(right))
        );
        assert.deepEqual(
            listSortedColumnNames(db, 'session_deliveries'),
            [
                'child_session_key',
                'created_at',
                'cron_job_id',
                'delivered_at',
                'delivery_channel',
                'delivery_target',
                'id',
                'mode',
                'parent_session_key',
                'payload_json',
                'run_id',
                'source_message_id',
                'stats_json',
                'status',
                'stream_log_path',
                'target_message_id',
                'transcript_path',
                'updated_at',
            ].sort((left, right) => left.localeCompare(right))
        );
        assert.deepEqual(
            listSortedColumnNames(db, 'cron_jobs'),
            [
                'agent_id',
                'created_at',
                'delete_after_run',
                'delivery_json',
                'description',
                'enabled',
                'id',
                'last_synced_at',
                'name',
                'payload_json',
                'raw_json',
                'runtime_cron_job_id',
                'runtime_id',
                'schedule_json',
                'state_json',
                'updated_at',
            ].sort((left, right) => left.localeCompare(right))
        );
        assert.deepEqual(
            listSortedColumnNames(db, 'cron_runs'),
            [
                'chat_id',
                'execution_error_code',
                'execution_error_message',
                'finished_at',
                'id',
                'job_id',
                'runtime_id',
                'scheduled_for',
                'started_at',
                'status',
                'synced_at',
                'trigger',
                'turn_id',
            ].sort((left, right) => left.localeCompare(right))
        );
    });
});

test('ensureDatabaseSchema repairs legacy cron cache tables before indexing them', async () => {
    await withTempDatabase(async (db) => {
        db.exec(`
            CREATE TABLE cron_runs (
                session_key TEXT PRIMARY KEY NOT NULL,
                job_id TEXT NOT NULL,
                provider_job_id TEXT,
                session_id TEXT NOT NULL,
                runtime_id TEXT,
                runtime_run_id TEXT,
                runtime_session_key TEXT,
                agent_id TEXT,
                run_at TEXT NOT NULL,
                status TEXT,
                summary TEXT,
                error TEXT,
                delivery_status TEXT,
                duration_ms INTEGER,
                synced_at TEXT NOT NULL,
                trigger TEXT NOT NULL DEFAULT 'schedule'
            );
            CREATE INDEX cron_runs_job_id_run_at_idx
                ON cron_runs (job_id, run_at);
            CREATE INDEX cron_runs_provider_job_id_run_at_idx
                ON cron_runs (provider_job_id, run_at);
            CREATE INDEX cron_runs_run_at_idx ON cron_runs (run_at);
            CREATE INDEX cron_runs_session_id_idx
                ON cron_runs (session_id);
            CREATE TABLE cron_jobs (
                id TEXT PRIMARY KEY NOT NULL,
                runtime_id TEXT NOT NULL,
                runtime_cron_job_id TEXT NOT NULL,
                agent_id TEXT,
                name TEXT NOT NULL,
                description TEXT,
                enabled INTEGER NOT NULL,
                schedule_json TEXT NOT NULL,
                state_json TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                delivery_json TEXT,
                delete_after_run INTEGER NOT NULL,
                wake_mode TEXT NOT NULL,
                raw_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                last_synced_at TEXT NOT NULL
            );
            INSERT INTO cron_runs (
                session_key,
                job_id,
                provider_job_id,
                session_id,
                runtime_id,
                runtime_run_id,
                run_at,
                status,
                synced_at
            )
            VALUES (
                'cron_old_1',
                'job_old_1',
                'provider_job_old_1',
                'session_old_1',
                'runtime_old_1',
                'turn_old_1',
                '2026-07-06T13:00:00.000Z',
                'success',
                '2026-07-06T13:00:01.000Z'
            );
            INSERT INTO cron_jobs (
                id,
                runtime_id,
                runtime_cron_job_id,
                agent_id,
                name,
                enabled,
                schedule_json,
                state_json,
                payload_json,
                delivery_json,
                delete_after_run,
                wake_mode,
                raw_json,
                created_at,
                updated_at,
                last_synced_at
            )
            VALUES (
                'job_old_1',
                'runtime_old_1',
                'runtime_job_old_1',
                'agent_old_1',
                'Legacy Job',
                1,
                '{}',
                '{}',
                '{}',
                '{}',
                0,
                'workspace',
                '{}',
                '2026-07-06T12:59:00.000Z',
                '2026-07-06T12:59:00.000Z',
                '2026-07-06T13:00:01.000Z'
            );
        `);

        await runBootstrapAgainst(db);

        assert.deepEqual(
            listSortedColumnNames(db, 'cron_runs'),
            [
                'chat_id',
                'execution_error_code',
                'execution_error_message',
                'finished_at',
                'id',
                'job_id',
                'runtime_id',
                'scheduled_for',
                'started_at',
                'status',
                'synced_at',
                'trigger',
                'turn_id',
            ].sort((left, right) => left.localeCompare(right))
        );
        assert.deepEqual(
            listSortedColumnNames(db, 'cron_jobs'),
            [
                'agent_id',
                'created_at',
                'delete_after_run',
                'delivery_json',
                'description',
                'enabled',
                'id',
                'last_synced_at',
                'name',
                'payload_json',
                'raw_json',
                'runtime_cron_job_id',
                'runtime_id',
                'schedule_json',
                'state_json',
                'updated_at',
            ].sort((left, right) => left.localeCompare(right))
        );
        assert.deepEqual(
            db
                .query(
                    `SELECT id, job_id, runtime_id, turn_id, scheduled_for, status, synced_at, trigger
                 FROM cron_runs;`
                )
                .all(),
            [
                {
                    id: 'cron_old_1',
                    job_id: 'job_old_1',
                    runtime_id: 'runtime_old_1',
                    scheduled_for: '2026-07-06T13:00:00.000Z',
                    status: 'success',
                    synced_at: '2026-07-06T13:00:01.000Z',
                    trigger: 'schedule',
                    turn_id: 'turn_old_1',
                },
            ]
        );
        assert.deepEqual(
            db
                .query(
                    `SELECT id, runtime_id, runtime_cron_job_id, agent_id, name, delivery_json
                 FROM cron_jobs;`
                )
                .all(),
            [
                {
                    agent_id: 'agent_old_1',
                    delivery_json: '{}',
                    id: 'job_old_1',
                    name: 'Legacy Job',
                    runtime_cron_job_id: 'runtime_job_old_1',
                    runtime_id: 'runtime_old_1',
                },
            ]
        );
    });
});
