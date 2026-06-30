import {
    type AgentRuntimeMcpServer,
    type AgentRuntimeMcpServerCreate,
    agentRuntimeMcpServerSchema,
} from '@tavern/api';
import * as z from 'zod';
import { getDb } from '../db/connection';
import { namedParams } from '../db/sqlite';

const mcpServerSecretIdPrefix = 'mcp:';

/** Stored shape keeps real secret values; the API view masks them. */
const storedMcpServerSchema = z.object({
    args: z.array(z.string()),
    command: z.string().nullable(),
    env: z.record(z.string(), z.string()),
    name: z.string(),
    url: z.string().nullable(),
});

export type StoredMcpServer = z.infer<typeof storedMcpServerSchema>;

export function listMcpServers(): AgentRuntimeMcpServer[] {
    return listMcpServerRows().map((row) => toApiMcpServer(row));
}

export function getMcpServer(id: string) {
    const row = getMcpServerRow(id);
    return row ? { api: toApiMcpServer(row), stored: row.stored } : null;
}

export function saveMcpServer(id: string, input: AgentRuntimeMcpServerCreate) {
    const existing = getMcpServerRow(id);
    const stored = {
        args: input.command ? (input.args ?? []) : [],
        command: input.command ?? null,
        env: {
            ...(existing?.stored.env ?? {}),
            ...(input.env ?? {}),
        },
        name: input.name,
        url: input.url ?? null,
    } satisfies StoredMcpServer;

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
                id: `${mcpServerSecretIdPrefix}${id}`,
                now,
                secretJson: JSON.stringify(stored),
            })
        );

    return toApiMcpServer({ id, stored, updatedAt: now });
}

export function removeMcpServer(id: string) {
    const result = getDb()
        .prepare('DELETE FROM tavern_vault_secrets WHERE id = $id')
        .run(namedParams({ id: `${mcpServerSecretIdPrefix}${id}` }));
    return result.changes > 0;
}

export function mcpServerIdFromName(name: string) {
    const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, '-')
        .replace(/^-+|-+$/gu, '')
        .slice(0, 64);
    return slug || 'mcp-server';
}

export function mcpServerSecretEnvName(id: string, kind: 'env' | 'header', name: string) {
    const sanitize = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]+/gu, '_');
    return `TAVERN_MCP_${sanitize(id)}_${kind === 'env' ? 'ENV' : 'HDR'}_${sanitize(name)}`;
}

function listMcpServerRows() {
    const rows = getDb()
        .prepare(
            `SELECT id, secret_json, updated_at
             FROM tavern_vault_secrets
             WHERE id LIKE $pattern
             ORDER BY id`
        )
        .all(namedParams({ pattern: `${mcpServerSecretIdPrefix}%` })) as {
        id: string;
        secret_json: string;
        updated_at: string;
    }[];

    return rows.map((row) => ({
        id: row.id.slice(mcpServerSecretIdPrefix.length),
        stored: parseStoredMcpServer(row.secret_json),
        updatedAt: row.updated_at,
    }));
}

function getMcpServerRow(id: string) {
    const row = getDb()
        .prepare('SELECT secret_json, updated_at FROM tavern_vault_secrets WHERE id = $id')
        .get(namedParams({ id: `${mcpServerSecretIdPrefix}${id}` })) as
        | { secret_json: string; updated_at: string }
        | undefined;

    return row
        ? { id, stored: parseStoredMcpServer(row.secret_json), updatedAt: row.updated_at }
        : null;
}

function parseStoredMcpServer(secretJson: string): StoredMcpServer {
    const parsed = storedMcpServerSchema.safeParse(JSON.parse(secretJson));
    if (!parsed.success) {
        throw new Error('Stored MCP server is invalid; re-save it.');
    }
    return parsed.data;
}

function toApiMcpServer(row: { id: string; stored: StoredMcpServer; updatedAt: string }) {
    return agentRuntimeMcpServerSchema.parse({
        args: row.stored.args,
        command: row.stored.command,
        enabled: true,
        name: row.stored.name,
        transport: row.stored.command ? 'stdio' : 'http',
        updatedAt: row.updatedAt,
        url: row.stored.url,
    });
}
