import { databaseClient } from './index.ts';

type SchemaStatementRunner = (filter: (statement: string) => boolean) => void;

const currentCronRunColumns = new Set([
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
]);

const currentCronJobColumns = new Set([
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
]);

export function repairCronCacheTables(runSchemaStatements: SchemaStatementRunner) {
    if (tableHasUnexpectedColumns('cron_runs', currentCronRunColumns)) {
        rebuildLegacyCronRunsTable(runSchemaStatements);
    }

    if (tableHasUnexpectedColumns('cron_jobs', currentCronJobColumns)) {
        rebuildLegacyCronJobsTable(runSchemaStatements);
    }

    createCronCacheTables(runSchemaStatements);
}

function createCronCacheTables(runSchemaStatements: SchemaStatementRunner) {
    runSchemaStatements(
        (statement) =>
            statement.startsWith('CREATE TABLE IF NOT EXISTS cron_runs') ||
            statement.startsWith('CREATE TABLE IF NOT EXISTS cron_jobs')
    );
}

function rebuildLegacyCronRunsTable(runSchemaStatements: SchemaStatementRunner) {
    databaseClient.exec('DROP TABLE IF EXISTS cron_runs_legacy_repair;');
    databaseClient.exec('ALTER TABLE cron_runs RENAME TO cron_runs_legacy_repair;');
    createCronCacheTables(runSchemaStatements);
    databaseClient.exec(`
        INSERT INTO cron_runs (
            id,
            job_id,
            runtime_id,
            chat_id,
            turn_id,
            scheduled_for,
            started_at,
            finished_at,
            status,
            execution_error_code,
            execution_error_message,
            synced_at,
            trigger
        )
        SELECT
            session_key,
            job_id,
            runtime_id,
            NULL,
            runtime_run_id,
            run_at,
            NULL,
            NULL,
            COALESCE(status, 'queued'),
            CASE WHEN error IS NULL THEN NULL ELSE 'execution_failed' END,
            error,
            synced_at,
            trigger
        FROM cron_runs_legacy_repair;
    `);
    databaseClient.exec('DROP TABLE cron_runs_legacy_repair;');
}

function rebuildLegacyCronJobsTable(runSchemaStatements: SchemaStatementRunner) {
    databaseClient.exec('DROP TABLE IF EXISTS cron_jobs_legacy_repair;');
    databaseClient.exec('ALTER TABLE cron_jobs RENAME TO cron_jobs_legacy_repair;');
    createCronCacheTables(runSchemaStatements);
    databaseClient.exec(`
        INSERT INTO cron_jobs (
            id,
            runtime_id,
            runtime_cron_job_id,
            agent_id,
            name,
            description,
            enabled,
            schedule_json,
            state_json,
            payload_json,
            delivery_json,
            delete_after_run,
            raw_json,
            created_at,
            updated_at,
            last_synced_at
        )
        SELECT
            id,
            runtime_id,
            runtime_cron_job_id,
            agent_id,
            name,
            description,
            enabled,
            schedule_json,
            state_json,
            payload_json,
            delivery_json,
            delete_after_run,
            raw_json,
            created_at,
            updated_at,
            last_synced_at
        FROM cron_jobs_legacy_repair
        WHERE agent_id IS NOT NULL
          AND delivery_json IS NOT NULL;
    `);
    databaseClient.exec('DROP TABLE cron_jobs_legacy_repair;');
}

function tableHasUnexpectedColumns(table: string, expectedColumns: Set<string>) {
    const columns = databaseClient.query(`PRAGMA table_info(${table});`).all() as Array<{
        name: string;
    }>;

    if (columns.length === 0) {
        return false;
    }

    const actualColumnNames = new Set(columns.map((column) => column.name));

    if (actualColumnNames.size !== expectedColumns.size) {
        return true;
    }

    return columns.some((column) => !expectedColumns.has(column.name));
}
