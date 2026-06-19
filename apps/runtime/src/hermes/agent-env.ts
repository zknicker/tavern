import {
    type AgentRuntimeAgentEnv,
    type AgentRuntimeSaveAgentEnv,
    agentRuntimeAgentEnvSchema,
} from '@tavern/api';
import * as z from 'zod';
import { getDb } from '../db/connection';
import { namedParams } from '../db/sqlite';

const agentEnvSecretId = 'agent-env';
const managedAgentEnvNamesMetadataKey = 'hermes:managed-agent-env-names';

const storedAgentEnvVariableSchema = z.object({
    name: z.string().trim().min(1),
    value: z.string().min(1),
});

const storedAgentEnvSchema = z.object({
    variables: z.array(storedAgentEnvVariableSchema),
});

export function getAgentEnv(): AgentRuntimeAgentEnv {
    const row = getAgentEnvRow();

    if (!row) {
        return { updatedAt: null, variables: [] };
    }

    return toApiAgentEnv(row);
}

export function saveAgentEnv(input: AgentRuntimeSaveAgentEnv): AgentRuntimeAgentEnv {
    const existing = getAgentEnvRow()?.stored.variables ?? [];
    const existingValues = new Map(existing.map((entry) => [entry.name, entry.value]));
    const seenNames = new Set<string>();
    const variables = input.variables.map((entry) => {
        if (seenNames.has(entry.name)) {
            throw new Error(`Agent env var "${entry.name}" is duplicated.`);
        }
        seenNames.add(entry.name);

        const value = entry.value ?? existingValues.get(entry.name);
        if (!value) {
            throw new Error(`Agent env var "${entry.name}" needs a value.`);
        }

        return { name: entry.name, value };
    });

    const now = new Date().toISOString();
    getDb()
        .prepare(
            `INSERT INTO tavern_vault_secrets (id, secret_json, created_at, updated_at)
             VALUES ($id, $secretJson, $now, $now)
             ON CONFLICT(id) DO UPDATE SET
               secret_json = excluded.secret_json,
               updated_at = excluded.updated_at`
        )
        .run(
            namedParams({
                id: agentEnvSecretId,
                now,
                secretJson: JSON.stringify({ variables }),
            })
        );

    return toApiAgentEnv({ stored: { variables }, updatedAt: now });
}

export function resolveAgentEnvEntries(): {
    envEntries: Map<string, string>;
    staleNames: string[];
} {
    const current = getAgentEnvRow()?.stored.variables ?? [];
    const currentNames = current.map((entry) => entry.name);
    const staleNames = readManagedAgentEnvNames().filter((name) => !currentNames.includes(name));
    writeManagedAgentEnvNames(currentNames);

    return {
        envEntries: new Map(current.map((entry) => [entry.name, entry.value])),
        staleNames,
    };
}

function getAgentEnvRow() {
    const row = getDb()
        .prepare('SELECT secret_json, updated_at FROM tavern_vault_secrets WHERE id = $id')
        .get(namedParams({ id: agentEnvSecretId })) as
        | { secret_json: string; updated_at: string }
        | undefined;

    return row ? { stored: parseStoredAgentEnv(row.secret_json), updatedAt: row.updated_at } : null;
}

function parseStoredAgentEnv(secretJson: string) {
    const parsed = storedAgentEnvSchema.safeParse(JSON.parse(secretJson));
    if (!parsed.success) {
        throw new Error('Stored agent env vars are invalid; re-save them.');
    }
    return parsed.data;
}

function toApiAgentEnv(row: {
    stored: z.infer<typeof storedAgentEnvSchema>;
    updatedAt: string;
}): AgentRuntimeAgentEnv {
    return agentRuntimeAgentEnvSchema.parse({
        updatedAt: row.updatedAt,
        variables: row.stored.variables
            .map((entry) => ({ hasValue: true, name: entry.name, value: entry.value }))
            .sort((left, right) => left.name.localeCompare(right.name)),
    });
}

function readManagedAgentEnvNames(): string[] {
    const row = getDb()
        .prepare('SELECT value FROM runtime_metadata WHERE key = $key')
        .get(namedParams({ key: managedAgentEnvNamesMetadataKey })) as
        | { value: string }
        | undefined;

    if (!row) {
        return [];
    }

    const parsed = z.array(z.string()).safeParse(JSON.parse(row.value));
    return parsed.success ? parsed.data : [];
}

function writeManagedAgentEnvNames(names: string[]) {
    getDb()
        .prepare(
            `INSERT INTO runtime_metadata (key, value, updated_at)
             VALUES ($key, $value, $now)
             ON CONFLICT(key) DO UPDATE SET
               value = excluded.value,
               updated_at = excluded.updated_at`
        )
        .run(
            namedParams({
                key: managedAgentEnvNamesMetadataKey,
                now: new Date().toISOString(),
                value: JSON.stringify(names),
            })
        );
}
