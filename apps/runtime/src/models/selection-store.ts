import type { AgentRuntimeModelName } from '@tavern/api';
import { agentRuntimeModelNameSchema } from '@tavern/api';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';

export interface AgentModelSelectionRecord {
    agentId: string;
    invalidReason: null | string;
    lastValidatedAt: null | string;
    modelName: AgentRuntimeModelName;
    status: 'invalid' | 'valid' | 'unknown';
    updatedAt: string;
}

interface AgentModelSelectionRow {
    agent_id: string;
    invalid_reason: null | string;
    last_validated_at: null | string;
    model_id: string;
    provider_id: string;
    status: 'invalid' | 'valid' | 'unknown';
    updated_at: string;
}

export function readAgentModelSelection(
    agentId: string,
    db: Database = getDb()
): AgentModelSelectionRecord | null {
    const row = db
        .prepare('SELECT * FROM agent_model_selections WHERE agent_id = $agentId LIMIT 1')
        .get(namedParams({ agentId })) as AgentModelSelectionRow | null;

    return row ? rowToSelection(row) : null;
}

export function saveAgentModelSelection(input: {
    agentId: string;
    db?: Database;
    invalidReason?: null | string;
    lastValidatedAt?: null | string;
    modelName: AgentRuntimeModelName;
    status?: AgentModelSelectionRecord['status'];
}) {
    const db = input.db ?? getDb();
    const modelName = agentRuntimeModelNameSchema.parse(input.modelName);
    const updatedAt = new Date().toISOString();
    const status = input.status ?? 'unknown';

    db.prepare(
        `
        INSERT INTO agent_model_selections (
            agent_id,
            provider_id,
            model_id,
            status,
            invalid_reason,
            last_validated_at,
            updated_at
        )
        VALUES (
            $agentId,
            $providerId,
            $modelId,
            $status,
            $invalidReason,
            $lastValidatedAt,
            $updatedAt
        )
        ON CONFLICT(agent_id) DO UPDATE SET
            provider_id = excluded.provider_id,
            model_id = excluded.model_id,
            status = excluded.status,
            invalid_reason = excluded.invalid_reason,
            last_validated_at = excluded.last_validated_at,
            updated_at = excluded.updated_at
    `
    ).run(
        namedParams({
            agentId: input.agentId,
            invalidReason: input.invalidReason ?? null,
            lastValidatedAt: input.lastValidatedAt ?? null,
            modelId: modelName.model,
            providerId: modelName.provider,
            status,
            updatedAt,
        })
    );

    const saved = readAgentModelSelection(input.agentId, db);
    if (!saved) {
        throw new Error(`Agent model selection for "${input.agentId}" was not persisted.`);
    }
    return saved;
}

export function deleteAgentModelSelection(agentId: string, db: Database = getDb()) {
    db.prepare('DELETE FROM agent_model_selections WHERE agent_id = $agentId').run(
        namedParams({ agentId })
    );
}

function rowToSelection(row: AgentModelSelectionRow): AgentModelSelectionRecord {
    return {
        agentId: row.agent_id,
        invalidReason: row.invalid_reason,
        lastValidatedAt: row.last_validated_at,
        modelName: agentRuntimeModelNameSchema.parse({
            model: row.model_id,
            provider: row.provider_id,
        }),
        status: row.status,
        updatedAt: row.updated_at,
    };
}
