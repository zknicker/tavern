import appPackage from '../../../website/package.json';
import { parseAgentRuntimeConnectionAuth } from '../agent-runtime-connection/auth.ts';
import {
    type AgentRuntimeConnection,
    agentRuntimeConnectionSchema,
} from '../agent-runtime-connection/contracts.ts';
import { getRequiredRuntimeVersion } from '../agent-runtime-connection/version-compatibility.ts';
import { databaseClient } from '../db/index.ts';
import { getAgentRuntimeConnection } from '../storage/agent-runtime-connections.ts';
import { createAgentRuntimeClientForConnection } from './client-factory.ts';

export function createConfiguredAgentRuntimeClient() {
    const connection = getCurrentConfiguredAgentRuntimeConnection();

    if (!connection) {
        return null;
    }

    return createAgentRuntimeClientForConnection(connection);
}

export async function createConfiguredAgentRuntimeClientForRuntimeId(runtimeId: string) {
    const connection = await getAgentRuntimeConnection(runtimeId);

    if (!(connection?.enabled && connection.lastCheckedAt)) {
        return null;
    }

    return createAgentRuntimeClientForConnection(connection);
}

export async function requireConfiguredAgentRuntimeClientForRuntimeId(runtimeId: string) {
    const client = await createConfiguredAgentRuntimeClientForRuntimeId(runtimeId);

    if (!client) {
        throw new Error(`Tavern Runtime connection "${runtimeId}" is not configured.`);
    }

    return client;
}

export function getCurrentConfiguredAgentRuntimeConnection():
    | (AgentRuntimeConnection & { authJson?: null | string })
    | null {
    try {
        const record = databaseClient
            .query(
                `select
                    id,
                    name,
                    base_url as baseUrl,
                    auth_json as authJson,
                    enabled,
                    is_active as isActive,
                    last_checked_at as lastCheckedAt,
                    last_error as lastError,
                    last_synced_at as lastSyncedAt,
                    'saved' as source
                from agent_runtime_connections
                where enabled = 1 and is_active = 1
                order by updated_at desc
                limit 1`
            )
            .get();

        return parseConfiguredAgentRuntimeConnection(record);
    } catch {
        return null;
    }
}

function parseConfiguredAgentRuntimeConnection(record: unknown) {
    const raw = record as null | {
        baseUrl: string;
        enabled: boolean | number;
        isActive: boolean | number;
        authJson?: null | string;
        id: string;
        lastCheckedAt: null | string;
        lastError: null | string;
        lastSyncedAt: null | string;
        name: string;
        source: 'saved';
    };

    if (!raw) {
        return null;
    }

    const parsed = agentRuntimeConnectionSchema.parse({
        ...raw,
        appVersion: appPackage.version,
        authConfigured: Boolean(parseAgentRuntimeConnectionAuth(raw.authJson)),
        enabled: Boolean(raw.enabled),
        isActive: Boolean(raw.isActive),
        requiredRuntimeVersion: getRequiredRuntimeVersion(appPackage.version),
        runtimeCapabilities: [],
        runtimeVersion: null,
        versionStatus: 'unknown',
    });

    return {
        ...parsed,
        authJson: raw.authJson,
    };
}
