import {
    type AgentRuntimeConnector,
    type AgentRuntimeSaveConnector,
    agentRuntimeConnectorSchema,
} from '@tavern/api';
import * as z from 'zod';
import { getDb } from '../db/connection';
import { namedParams } from '../db/sqlite';
import type { HermesConnectorsDomain, McpServerEntry } from './generated-config';

const connectorSecretIdPrefix = 'connector:';
const managedConnectorIdsMetadataKey = 'hermes:managed-connector-ids';

/** Stored shape keeps real secret values; the API view masks them. */
const storedConnectorSchema = z.object({
    args: z.array(z.string()),
    command: z.string().nullable(),
    env: z.record(z.string(), z.string()),
    headers: z.record(z.string(), z.string()),
    name: z.string(),
    timeoutSeconds: z.number().nullable(),
    transport: z.enum(['command', 'url']),
    url: z.string().nullable(),
});

export type StoredConnector = z.infer<typeof storedConnectorSchema>;

export function listConnectors(): AgentRuntimeConnector[] {
    return listConnectorRows().map((row) => toApiConnector(row));
}

export function getConnector(id: string) {
    const row = getConnectorRow(id);
    return row ? { api: toApiConnector(row), stored: row.stored } : null;
}

export function saveConnector(id: string, input: AgentRuntimeSaveConnector) {
    const existing = getConnectorRow(id);
    const stored = {
        args: input.transport === 'command' ? input.args : [],
        command: input.transport === 'command' ? input.command : null,
        env: carrySecretValues(input.env, existing?.stored.env ?? {}),
        headers: carrySecretValues(input.headers, existing?.stored.headers ?? {}),
        name: input.name,
        timeoutSeconds: input.timeoutSeconds,
        transport: input.transport,
        url: input.transport === 'url' ? input.url : null,
    } satisfies StoredConnector;

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
                id: `${connectorSecretIdPrefix}${id}`,
                now,
                secretJson: JSON.stringify(stored),
            })
        );

    return toApiConnector({ id, stored, updatedAt: now });
}

export function deleteConnector(id: string) {
    const result = getDb()
        .prepare('DELETE FROM tavern_vault_secrets WHERE id = $id')
        .run(namedParams({ id: `${connectorSecretIdPrefix}${id}` }));
    return result.changes > 0;
}

export function connectorIdFromName(name: string) {
    const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, '-')
        .replace(/^-+|-+$/gu, '')
        .slice(0, 64);
    return slug || 'connector';
}

/**
 * Resolve the generated-config connectors domain plus the secret env entries
 * the managed .env must carry. Stale ids (managed before, removed since) are
 * computed against the persisted managed-id list, which is then updated.
 */
export function resolveConnectorsDomain(): {
    domain: HermesConnectorsDomain;
    envEntries: Map<string, string>;
} {
    const rows = listConnectorRows();
    const servers: Record<string, McpServerEntry> = {};
    const envEntries = new Map<string, string>();

    for (const row of rows) {
        const { entry, secrets } = toMcpServerEntry(row.id, row.stored);
        servers[row.id] = entry;
        for (const [key, value] of secrets) {
            envEntries.set(key, value);
        }
    }

    const currentIds = rows.map((row) => row.id);
    const staleIds = readManagedConnectorIds().filter((id) => !currentIds.includes(id));
    writeManagedConnectorIds(currentIds);

    return { domain: { servers, staleIds }, envEntries };
}

export function connectorSecretEnvName(id: string, kind: 'env' | 'header', name: string) {
    const sanitize = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]+/gu, '_');
    return `TAVERN_MCP_${sanitize(id)}_${kind === 'env' ? 'ENV' : 'HDR'}_${sanitize(name)}`;
}

function toMcpServerEntry(id: string, stored: StoredConnector) {
    const secrets = new Map<string, string>();
    const interpolated = (kind: 'env' | 'header', values: Record<string, string>) => {
        const refs: Record<string, string> = {};
        for (const [name, value] of Object.entries(values)) {
            const envName = connectorSecretEnvName(id, kind, name);
            secrets.set(envName, value);
            refs[name] = `\${${envName}}`;
        }
        return refs;
    };

    const entry = {
        ...(stored.transport === 'command'
            ? { args: stored.args, command: stored.command ?? '' }
            : { url: stored.url ?? '' }),
        ...(Object.keys(stored.env).length > 0 ? { env: interpolated('env', stored.env) } : {}),
        ...(Object.keys(stored.headers).length > 0
            ? { headers: interpolated('header', stored.headers) }
            : {}),
        ...(stored.timeoutSeconds === null ? {} : { timeout: stored.timeoutSeconds }),
    } satisfies McpServerEntry;

    return { entry, secrets };
}

function carrySecretValues(
    input: { name: string; value?: string }[],
    existing: Record<string, string>
) {
    const next: Record<string, string> = {};
    for (const field of input) {
        const value = field.value ?? existing[field.name];
        if (!value) {
            throw new Error(`Secret value for "${field.name}" is missing.`);
        }
        next[field.name] = value;
    }
    return next;
}

function listConnectorRows() {
    const rows = getDb()
        .prepare(
            `SELECT id, secret_json, updated_at
             FROM tavern_vault_secrets
             WHERE id LIKE $pattern
             ORDER BY id`
        )
        .all(namedParams({ pattern: `${connectorSecretIdPrefix}%` })) as {
        id: string;
        secret_json: string;
        updated_at: string;
    }[];

    return rows.map((row) => ({
        id: row.id.slice(connectorSecretIdPrefix.length),
        stored: parseStoredConnector(row.secret_json),
        updatedAt: row.updated_at,
    }));
}

function getConnectorRow(id: string) {
    const row = getDb()
        .prepare('SELECT secret_json, updated_at FROM tavern_vault_secrets WHERE id = $id')
        .get(namedParams({ id: `${connectorSecretIdPrefix}${id}` })) as
        | { secret_json: string; updated_at: string }
        | undefined;

    return row
        ? { id, stored: parseStoredConnector(row.secret_json), updatedAt: row.updated_at }
        : null;
}

function parseStoredConnector(secretJson: string): StoredConnector {
    const parsed = storedConnectorSchema.safeParse(JSON.parse(secretJson));
    if (!parsed.success) {
        throw new Error('Stored connector is invalid; re-save it.');
    }
    return parsed.data;
}

function toApiConnector(row: { id: string; stored: StoredConnector; updatedAt: string }) {
    return agentRuntimeConnectorSchema.parse({
        args: row.stored.args,
        command: row.stored.command,
        env: maskSecretFields(row.stored.env),
        headers: maskSecretFields(row.stored.headers),
        id: row.id,
        name: row.stored.name,
        timeoutSeconds: row.stored.timeoutSeconds,
        transport: row.stored.transport,
        updatedAt: row.updatedAt,
        url: row.stored.url,
    });
}

function maskSecretFields(values: Record<string, string>) {
    return Object.keys(values)
        .sort()
        .map((name) => ({ hasValue: true, name }));
}

function readManagedConnectorIds(): string[] {
    const row = getDb()
        .prepare('SELECT value FROM runtime_metadata WHERE key = $key')
        .get(namedParams({ key: managedConnectorIdsMetadataKey })) as { value: string } | undefined;

    if (!row) {
        return [];
    }
    const parsed = z.array(z.string()).safeParse(JSON.parse(row.value));
    return parsed.success ? parsed.data : [];
}

function writeManagedConnectorIds(ids: string[]) {
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
                key: managedConnectorIdsMetadataKey,
                now: new Date().toISOString(),
                value: JSON.stringify(ids),
            })
        );
}
