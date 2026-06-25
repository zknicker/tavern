import {
    type AgentRuntimePlugin,
    type AgentRuntimePluginId,
    agentRuntimePluginIdSchema,
    agentRuntimePluginSchema,
} from '@tavern/api';
import type * as z from 'zod';
import { getDb } from '../db/connection';
import { namedParams } from '../db/sqlite';

export interface PluginDefinition {
    displayName: string;
    id: AgentRuntimePluginId;
}

export const pluginDefinitions = [
    {
        displayName: 'MerchBase',
        id: 'merchbase',
    },
] satisfies PluginDefinition[];

export function listPlugins(): AgentRuntimePlugin[] {
    return pluginDefinitions.map((definition) => getPlugin(definition.id));
}

export function getPlugin(id: AgentRuntimePluginId): AgentRuntimePlugin {
    const definition = getPluginDefinition(id);
    const row = readPluginRow(id);
    const secrets = readPluginSecretRow(id);

    return agentRuntimePluginSchema.parse({
        config: row?.config ?? {},
        displayName: definition.displayName,
        enabled: row?.enabled ?? false,
        id,
        secrets: secrets
            ? Object.keys(secrets.secret)
                  .sort()
                  .map((name) => ({ hasValue: true, name }))
            : [],
        updatedAt: row?.updatedAt ?? secrets?.updatedAt ?? null,
    });
}

export function readPluginConfig<T>(id: AgentRuntimePluginId, schema: z.ZodType<T>): T {
    const config = readPluginRow(id)?.config ?? {};
    return schema.parse(config);
}

export function writePluginConfig(input: {
    config: Record<string, unknown>;
    enabled: boolean;
    id: AgentRuntimePluginId;
}) {
    const now = new Date().toISOString();
    getDb()
        .prepare(
            `INSERT INTO runtime_plugins (id, enabled, config_json, created_at, updated_at)
             VALUES ($id, $enabled, $configJson, $now, $now)
             ON CONFLICT(id) DO UPDATE SET
               enabled = excluded.enabled,
               config_json = excluded.config_json,
               updated_at = excluded.updated_at`
        )
        .run(
            namedParams({
                configJson: JSON.stringify(input.config),
                enabled: input.enabled ? 1 : 0,
                id: input.id,
                now,
            })
        );
}

export function readPluginSecret<T>(id: AgentRuntimePluginId, schema: z.ZodType<T>): T | null {
    const row = readPluginSecretRow(id);
    return row ? schema.parse(row.secret) : null;
}

export function writePluginSecret(input: {
    id: AgentRuntimePluginId;
    secret: Record<string, unknown>;
}) {
    ensurePluginRow(input.id);
    const now = new Date().toISOString();
    getDb()
        .prepare(
            `INSERT INTO runtime_plugin_secrets
             (plugin_id, secret_json, created_at, updated_at)
             VALUES ($id, $secretJson, $now, $now)
             ON CONFLICT(plugin_id) DO UPDATE SET
               secret_json = excluded.secret_json,
               updated_at = excluded.updated_at`
        )
        .run(
            namedParams({
                id: input.id,
                now,
                secretJson: JSON.stringify(input.secret),
            })
        );
}

function ensurePluginRow(id: AgentRuntimePluginId) {
    if (readPluginRow(id)) {
        return;
    }
    writePluginConfig({ config: {}, enabled: false, id });
}

function getPluginDefinition(id: AgentRuntimePluginId) {
    return pluginDefinitions.find((definition) => definition.id === id)!;
}

function readPluginRow(id: AgentRuntimePluginId) {
    const parsedId = agentRuntimePluginIdSchema.parse(id);
    const row = getDb()
        .prepare(
            `SELECT enabled, config_json, updated_at
             FROM runtime_plugins
             WHERE id = $id`
        )
        .get(namedParams({ id: parsedId })) as
        | { config_json: string; enabled: number; updated_at: string }
        | undefined;

    return row
        ? {
              config: parseJsonRecord(row.config_json),
              enabled: Boolean(row.enabled),
              updatedAt: row.updated_at,
          }
        : null;
}

function readPluginSecretRow(id: AgentRuntimePluginId) {
    const parsedId = agentRuntimePluginIdSchema.parse(id);
    const row = getDb()
        .prepare(
            `SELECT secret_json, updated_at
             FROM runtime_plugin_secrets
             WHERE plugin_id = $id`
        )
        .get(namedParams({ id: parsedId })) as
        | { secret_json: string; updated_at: string }
        | undefined;

    return row
        ? {
              secret: parseJsonRecord(row.secret_json),
              updatedAt: row.updated_at,
          }
        : null;
}

function parseJsonRecord(value: string): Record<string, unknown> {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
    }
    throw new Error('Stored Plugin JSON is invalid; re-save it.');
}
