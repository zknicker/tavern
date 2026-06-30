import type { AgentRuntimeModelName, AgentRuntimeProfile } from '@tavern/api';
import { agentRuntimeModelNameSchema, agentRuntimeProfileSchema } from '@tavern/api';
import { getDb } from '../db/connection';
import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';

interface AgentRuntimeProfileRow {
    agent_id: string;
    created_at: string;
    default_model_json: string;
    sandbox_mode: AgentRuntimeProfile['sandboxMode'];
    updated_at: string;
}

export function readAgentRuntimeProfile(agentId: string, db: Database = getDb()) {
    const row = db
        .prepare('SELECT * FROM agent_runtime_profiles WHERE agent_id = $agentId LIMIT 1')
        .get(namedParams({ agentId })) as AgentRuntimeProfileRow | null;
    return row ? rowToProfile(row) : null;
}

export function saveAgentRuntimeProfile(input: {
    agentId: string;
    db?: Database;
    defaultModel: AgentRuntimeModelName;
    sandboxMode?: AgentRuntimeProfile['sandboxMode'];
}) {
    const db = input.db ?? getDb();
    const existing = readAgentRuntimeProfile(input.agentId, db);
    const defaultModel = agentRuntimeModelNameSchema.parse(input.defaultModel);
    const now = new Date().toISOString();

    db.prepare(
        `INSERT INTO agent_runtime_profiles (
            agent_id,
            default_model_json,
            sandbox_mode,
            created_at,
            updated_at
         )
         VALUES (
            $agentId,
            $defaultModelJson,
            $sandboxMode,
            $createdAt,
            $updatedAt
         )
         ON CONFLICT(agent_id) DO UPDATE SET
            default_model_json = excluded.default_model_json,
            sandbox_mode = excluded.sandbox_mode,
            updated_at = excluded.updated_at`
    ).run(
        namedParams({
            agentId: input.agentId,
            createdAt: existing?.updatedAt ?? now,
            defaultModelJson: JSON.stringify(defaultModel),
            sandboxMode: input.sandboxMode ?? existing?.sandboxMode ?? 'none',
            updatedAt: now,
        })
    );

    const saved = readAgentRuntimeProfile(input.agentId, db);
    if (!saved) {
        throw new Error(`Agent runtime profile for "${input.agentId}" was not persisted.`);
    }
    return saved;
}

function rowToProfile(row: AgentRuntimeProfileRow): AgentRuntimeProfile {
    return agentRuntimeProfileSchema.parse({
        agentId: row.agent_id,
        defaultModel: JSON.parse(row.default_model_json) as unknown,
        sandboxMode: row.sandbox_mode,
        updatedAt: row.updated_at,
    });
}
