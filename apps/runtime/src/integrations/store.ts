import {
    type AgentRuntimeIntegration,
    type AgentRuntimeIntegrationId,
    agentRuntimeIntegrationIdSchema,
    agentRuntimeIntegrationSchema,
} from '@tavern/api';
import type * as z from 'zod';
import { getDb } from '../db/connection';
import { namedParams } from '../db/sqlite';

export interface IntegrationDefinition {
    displayName: string;
    id: AgentRuntimeIntegrationId;
}

export const integrationDefinitions = [
    {
        displayName: 'MerchBase',
        id: 'merchbase',
    },
] satisfies IntegrationDefinition[];

export function listIntegrations(): AgentRuntimeIntegration[] {
    return integrationDefinitions.map((definition) => getIntegration(definition.id));
}

export function getIntegration(id: AgentRuntimeIntegrationId): AgentRuntimeIntegration {
    const definition = getIntegrationDefinition(id);
    const row = readIntegrationRow(id);
    const secrets = readIntegrationSecretRow(id);

    return agentRuntimeIntegrationSchema.parse({
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

export function readIntegrationConfig<T>(id: AgentRuntimeIntegrationId, schema: z.ZodType<T>): T {
    const config = readIntegrationRow(id)?.config ?? {};
    return schema.parse(config);
}

export function writeIntegrationConfig(input: {
    config: Record<string, unknown>;
    enabled: boolean;
    id: AgentRuntimeIntegrationId;
}) {
    const now = new Date().toISOString();
    getDb()
        .prepare(
            `INSERT INTO runtime_integrations (id, enabled, config_json, created_at, updated_at)
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

export function readIntegrationSecret<T>(
    id: AgentRuntimeIntegrationId,
    schema: z.ZodType<T>
): T | null {
    const row = readIntegrationSecretRow(id);
    return row ? schema.parse(row.secret) : null;
}

export function writeIntegrationSecret(input: {
    id: AgentRuntimeIntegrationId;
    secret: Record<string, unknown>;
}) {
    ensureIntegrationRow(input.id);
    const now = new Date().toISOString();
    getDb()
        .prepare(
            `INSERT INTO runtime_integration_secrets
             (integration_id, secret_json, created_at, updated_at)
             VALUES ($id, $secretJson, $now, $now)
             ON CONFLICT(integration_id) DO UPDATE SET
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

function ensureIntegrationRow(id: AgentRuntimeIntegrationId) {
    if (readIntegrationRow(id)) {
        return;
    }
    writeIntegrationConfig({ config: {}, enabled: false, id });
}

function getIntegrationDefinition(id: AgentRuntimeIntegrationId) {
    return integrationDefinitions.find((definition) => definition.id === id)!;
}

function readIntegrationRow(id: AgentRuntimeIntegrationId) {
    const parsedId = agentRuntimeIntegrationIdSchema.parse(id);
    const row = getDb()
        .prepare(
            `SELECT enabled, config_json, updated_at
             FROM runtime_integrations
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

function readIntegrationSecretRow(id: AgentRuntimeIntegrationId) {
    const parsedId = agentRuntimeIntegrationIdSchema.parse(id);
    const row = getDb()
        .prepare(
            `SELECT secret_json, updated_at
             FROM runtime_integration_secrets
             WHERE integration_id = $id`
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
    throw new Error('Stored Integration JSON is invalid; re-save it.');
}
