import type { AgentRuntimeConnectionAuth } from './contracts.ts';

export interface EnvironmentAgentRuntimeConnectionRecord {
    authJson: null | string;
    baseUrl: string;
    createdAt: string;
    enabled: boolean;
    id: string;
    isActive: boolean;
    lastCheckedAt: null | string;
    lastError: null | string;
    lastSyncedAt: null | string;
    name: string;
    updatedAt: string;
}

let environmentConnection: EnvironmentAgentRuntimeConnectionRecord | null = null;

export function clearEnvironmentAgentRuntimeConnection() {
    environmentConnection = null;
}

export function getEnvironmentAgentRuntimeConnection() {
    return environmentConnection;
}

export function saveEnvironmentAgentRuntimeConnection(input: {
    auth?: AgentRuntimeConnectionAuth | null;
    baseUrl: string;
    enabled?: boolean;
    id: string;
    lastCheckedAt: null | string;
    lastError: null | string;
    lastSyncedAt?: null | string;
    name: string;
}) {
    const timestamp = new Date().toISOString();
    // When `auth` is not provided (undefined), preserve the existing authJson so that
    // status-update calls (mark sync, mark reachable, mark failure) don't silently wipe the token.
    const authJson =
        input.auth === undefined
            ? (environmentConnection?.authJson ?? null)
            : input.auth
              ? JSON.stringify(input.auth)
              : null;

    environmentConnection = {
        authJson,
        baseUrl: input.baseUrl,
        createdAt: environmentConnection?.createdAt ?? timestamp,
        enabled: input.enabled ?? true,
        id: input.id,
        isActive: true,
        lastCheckedAt: input.lastCheckedAt,
        lastError: input.lastError,
        lastSyncedAt: input.lastSyncedAt ?? environmentConnection?.lastSyncedAt ?? null,
        name: input.name,
        updatedAt: timestamp,
    };

    return environmentConnection;
}
