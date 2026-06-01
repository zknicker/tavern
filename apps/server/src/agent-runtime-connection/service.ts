import type { AgentRuntimeCapabilityHealth } from '@tavern/api';
import appPackage from '../../../website/package.json';
import { createAgentRuntimeClientForConnection } from '../agent-runtime/client-factory.ts';
import {
    activateAgentRuntimeConnection,
    agentRuntimeConnectionId,
    deleteAgentRuntimeConnection as deleteStoredAgentRuntimeConnection,
    disableAgentRuntimeConnection,
    getDefaultAgentRuntimeConnection,
    getAgentRuntimeConnection as getStoredAgentRuntimeConnection,
    listReachableAgentRuntimeConnections,
    listAgentRuntimeConnections as listStoredAgentRuntimeConnections,
    saveAgentRuntimeConnection as saveStoredAgentRuntimeConnection,
} from '../storage/agent-runtime-connections.ts';
import { parseAgentRuntimeConnectionAuth } from './auth.ts';
import type { AgentRuntimeCapabilityStatus, AgentRuntimeConnection } from './contracts.ts';
import { type AgentRuntimeCapability, agentRuntimeCapabilitySchema } from './contracts.ts';
import { getRequiredRuntimeVersion, getRuntimeVersionStatus } from './version-compatibility.ts';

function getAgentRuntimeEnvironmentBaseUrl() {
    return process.env.TAVERN_RUNTIME_URL?.trim() || null;
}

function clearAgentRuntimeEnvironmentOverride() {
    process.env.TAVERN_RUNTIME_URL = undefined;
}

function toErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

function toSecureRuntimeUrl(baseUrl: string) {
    const url = new URL(baseUrl);

    if (url.protocol !== 'http:') {
        return null;
    }

    url.protocol = 'https:';
    const normalized = url.toString();
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

let currentAgentRuntimeUrl = getAgentRuntimeEnvironmentBaseUrl();

function toAgentRuntimeConnection(input: {
    appVersion?: string;
    authConfigured: boolean;
    baseUrl: string;
    capabilities?: AgentRuntimeConnection['capabilities'];
    enabled: boolean;
    id: string;
    isActive: boolean;
    lastCheckedAt: string | null;
    lastError: string | null;
    lastSyncedAt: string | null;
    name: string;
    runtimeVersion?: null | string;
    source: 'environment' | 'saved';
}): AgentRuntimeConnection {
    const capabilities = input.capabilities ?? [];
    const appVersion = input.appVersion ?? appPackage.version;
    const runtimeVersion = input.runtimeVersion ?? null;
    const requiredRuntimeVersion = getRequiredRuntimeVersion(appVersion);

    return {
        appVersion,
        authConfigured: input.authConfigured,
        baseUrl: input.baseUrl,
        capabilities,
        enabled: input.enabled,
        id: input.id,
        isActive: input.isActive,
        lastCheckedAt: input.lastCheckedAt,
        lastError: input.lastError,
        lastSyncedAt: input.lastSyncedAt,
        name: input.name,
        requiredRuntimeVersion,
        runtimeCapabilities: capabilities,
        runtimeVersion,
        source: input.source,
        versionStatus: getRuntimeVersionStatus({
            appVersion,
            requiredRuntimeVersion,
            runtimeVersion,
        }),
    };
}

async function getRuntimeOwnedStatus(input: { baseUrl: string; runtimeId: string }): Promise<{
    capabilities: AgentRuntimeConnection['capabilities'];
    lastError: null | string;
    runtimeVersion: null | string;
}> {
    let client: ReturnType<typeof createAgentRuntimeClientForConnection> | null = null;
    try {
        client = createAgentRuntimeClientForConnection({ baseUrl: input.baseUrl });
        const { capabilities, info } = await client.listCapabilities();
        return {
            capabilities: capabilities.map((capability) =>
                toAppCapabilityStatus(capability, input.runtimeId)
            ),
            lastError: null,
            runtimeVersion: info.version,
        };
    } catch (error) {
        return { capabilities: [], lastError: toErrorMessage(error), runtimeVersion: null };
    } finally {
        client?.close();
    }
}

function toAppCapabilityStatus(
    capability: AgentRuntimeCapabilityHealth,
    runtimeId: string
): AgentRuntimeCapabilityStatus {
    return {
        capability: capability.id,
        checkedAt: capability.checkedAt,
        errorCode: null,
        lastHealthyAt: capability.lastHealthyAt,
        metadataJson: JSON.stringify(capability.metadata),
        method: 'runtime.capabilities',
        reason: capability.reason,
        runtimeId,
        state: capability.state,
        technicalMessage: capability.technicalMessage,
        updatedAt: capability.updatedAt,
    };
}

async function toSavedAgentRuntimeConnection(
    record: Awaited<ReturnType<typeof getDefaultAgentRuntimeConnection>>
): Promise<AgentRuntimeConnection | null> {
    if (!record) {
        return null;
    }
    const runtimeStatus = await getRuntimeOwnedStatus({
        baseUrl: record.baseUrl,
        runtimeId: record.id,
    });

    return toAgentRuntimeConnection({
        authConfigured: parseAgentRuntimeConnectionAuth(record.authJson) !== null,
        baseUrl: record.baseUrl,
        capabilities: runtimeStatus.capabilities,
        enabled: record.enabled,
        id: record.id,
        isActive: record.isActive,
        lastCheckedAt: record.lastCheckedAt,
        lastError: runtimeStatus.lastError,
        lastSyncedAt: record.lastSyncedAt,
        name: record.name,
        runtimeVersion: runtimeStatus.runtimeVersion,
        source: 'saved',
    });
}

export function getCurrentAgentRuntimeUrl() {
    return currentAgentRuntimeUrl;
}

export async function loadAgentRuntimeConnection() {
    const saved = await getDefaultAgentRuntimeConnection();
    const environmentBaseUrl = getAgentRuntimeEnvironmentBaseUrl();

    currentAgentRuntimeUrl = environmentBaseUrl ?? saved?.baseUrl ?? null;

    if (environmentBaseUrl) {
        const checked = await checkAgentRuntimeConnection({
            auth: undefined,
            baseUrl: environmentBaseUrl,
        });
        const record = await saveStoredAgentRuntimeConnection({
            baseUrl: checked.baseUrl,
            enabled: true,
            id: checked.capabilities.info.agentRuntimeId,
            isActive: true,
            lastCheckedAt: null,
            lastError: null,
            name: checked.capabilities.info.name,
        });
        currentAgentRuntimeUrl = checked.baseUrl;

        return toAgentRuntimeConnection({
            baseUrl: checked.baseUrl,
            authConfigured: false,
            enabled: true,
            id: record?.id ?? checked.capabilities.info.agentRuntimeId,
            isActive: true,
            lastCheckedAt: null,
            lastError: null,
            lastSyncedAt: null,
            name: checked.capabilities.info.name,
            runtimeVersion: checked.capabilities.info.version,
            source: 'environment',
        });
    }

    if (saved) {
        return await toSavedAgentRuntimeConnection(saved);
    }

    if (!currentAgentRuntimeUrl) {
        return null;
    }

    return toAgentRuntimeConnection({
        authConfigured: false,
        baseUrl: currentAgentRuntimeUrl,
        enabled: true,
        id: 'environment',
        isActive: true,
        lastCheckedAt: null,
        lastError: null,
        lastSyncedAt: null,
        name: 'Tavern Runtime',
        source: 'environment',
    });
}

export async function getAgentRuntimeConnection() {
    const saved = await getDefaultAgentRuntimeConnection();
    const environmentBaseUrl = getAgentRuntimeEnvironmentBaseUrl();

    if (environmentBaseUrl) {
        const environmentRecord = saved ?? (await getDefaultAgentRuntimeConnection());
        const runtimeId = environmentRecord?.id ?? agentRuntimeConnectionId;
        const runtimeStatus = await getRuntimeOwnedStatus({
            baseUrl: environmentBaseUrl,
            runtimeId,
        });

        return toAgentRuntimeConnection({
            baseUrl: environmentBaseUrl,
            authConfigured: false,
            enabled: true,
            id: runtimeId,
            isActive: true,
            capabilities: runtimeStatus.capabilities,
            lastCheckedAt: environmentRecord?.lastCheckedAt ?? null,
            lastError: runtimeStatus.lastError,
            lastSyncedAt: environmentRecord?.lastSyncedAt ?? null,
            name: 'Tavern Runtime',
            runtimeVersion: runtimeStatus.runtimeVersion,
            source: 'environment',
        });
    }

    if (saved) {
        return await toSavedAgentRuntimeConnection(saved);
    }

    if (!currentAgentRuntimeUrl) {
        return null;
    }

    return toAgentRuntimeConnection({
        authConfigured: false,
        baseUrl: currentAgentRuntimeUrl,
        enabled: true,
        id: 'environment',
        isActive: true,
        lastCheckedAt: null,
        lastError: null,
        lastSyncedAt: null,
        name: 'Tavern Runtime',
        source: 'environment',
    });
}

export async function refreshAgentRuntimeCapability(input: {
    capability: AgentRuntimeCapability;
}): Promise<AgentRuntimeCapabilityStatus> {
    const capability = agentRuntimeCapabilitySchema.parse(input.capability);
    const connection = await getAgentRuntimeConnection();
    if (!connection?.enabled) {
        throw new Error('Tavern Runtime is not configured.');
    }

    const client = createAgentRuntimeClientForConnection({ baseUrl: connection.baseUrl });
    try {
        const refreshed = await client.refreshCapability(capability);
        return toAppCapabilityStatus(refreshed, connection.id);
    } finally {
        client.close();
    }
}

export async function startAgentRuntimeUpdate() {
    const connection = await getAgentRuntimeConnection();
    if (!connection?.enabled) {
        throw new Error('Tavern Runtime is not configured.');
    }

    const client = createAgentRuntimeClientForConnection({ baseUrl: connection.baseUrl });
    try {
        return await client.startUpdate();
    } finally {
        client.close();
    }
}

export async function listAgentRuntimeConnections() {
    const records = await listStoredAgentRuntimeConnections();
    const connections = await Promise.all(records.map(toSavedAgentRuntimeConnection));

    return connections.filter((connection): connection is AgentRuntimeConnection =>
        Boolean(connection)
    );
}

export { agentRuntimeConnectionId };

export async function isAgentRuntimeReachable() {
    return (await listReachableAgentRuntimeConnections()).length > 0;
}

export async function saveAgentRuntimeConnection(input: {
    auth?: unknown;
    baseUrl: string;
    enabled?: boolean;
    id?: string;
    lastError: string | null;
}) {
    const checkedAt = new Date().toISOString();
    const auth = input.auth === undefined ? undefined : parseAgentRuntimeConnectionAuth(input.auth);
    let checked: Awaited<ReturnType<typeof checkAgentRuntimeConnection>>;

    try {
        checked = await checkAgentRuntimeConnection({
            auth: input.auth,
            baseUrl: input.baseUrl,
        });
    } catch (error) {
        const existing = input.id
            ? await getStoredAgentRuntimeConnection(input.id)
            : await getDefaultAgentRuntimeConnection();
        const message = toErrorMessage(error);
        const fallbackId = input.id ?? existing?.id ?? agentRuntimeConnectionId;

        await saveStoredAgentRuntimeConnection({
            auth,
            baseUrl: input.baseUrl,
            enabled: input.enabled,
            id: fallbackId,
            isActive: true,
            lastCheckedAt: checkedAt,
            lastError: message,
            lastSyncedAt: existing?.lastSyncedAt ?? null,
            name: existing?.name ?? 'Tavern Runtime',
        });

        currentAgentRuntimeUrl = getAgentRuntimeEnvironmentBaseUrl() ?? input.baseUrl;

        throw error;
    }

    const record = await saveStoredAgentRuntimeConnection({
        auth,
        baseUrl: checked.baseUrl,
        enabled: input.enabled,
        id: input.id ?? checked.capabilities.info.agentRuntimeId,
        isActive: true,
        lastCheckedAt: checkedAt,
        lastError: input.lastError,
        name: checked.capabilities.info.name,
    });

    currentAgentRuntimeUrl = getAgentRuntimeEnvironmentBaseUrl() ?? checked.baseUrl;

    return await toSavedAgentRuntimeConnection(record);
}

export async function clearAgentRuntimeConnection(options?: {
    clearEnvironmentOverride?: boolean;
    id?: string;
}) {
    const saved = options?.id
        ? await getStoredAgentRuntimeConnection(options.id)
        : await getDefaultAgentRuntimeConnection();
    if (saved) {
        await disableAgentRuntimeConnection(saved.id);
    }

    if (options?.clearEnvironmentOverride) {
        clearAgentRuntimeEnvironmentOverride();
    }

    currentAgentRuntimeUrl =
        getAgentRuntimeEnvironmentBaseUrl() ??
        (await getDefaultAgentRuntimeConnection())?.baseUrl ??
        null;
}

export async function selectAgentRuntimeConnection(input: { id: string }) {
    const record = await activateAgentRuntimeConnection(input.id);

    if (!record) {
        return null;
    }

    currentAgentRuntimeUrl = getAgentRuntimeEnvironmentBaseUrl() ?? record.baseUrl;

    return await toSavedAgentRuntimeConnection(record);
}

export async function deleteAgentRuntimeConnection(input: { id: string }) {
    await deleteStoredAgentRuntimeConnection(input.id);

    const active = await getDefaultAgentRuntimeConnection();
    currentAgentRuntimeUrl = getAgentRuntimeEnvironmentBaseUrl() ?? active?.baseUrl ?? null;
}

export async function checkAgentRuntimeConnection(input: { auth?: unknown; baseUrl: string }) {
    const auth = input.auth ? parseAgentRuntimeConnectionAuth(input.auth) : null;
    return await checkAgentRuntimeCapabilities({
        authJson: auth ? JSON.stringify(auth) : null,
        baseUrl: input.baseUrl,
    });
}

async function checkAgentRuntimeCapabilities(input: { authJson?: null | string; baseUrl: string }) {
    try {
        const client = createAgentRuntimeClientForConnection(input);
        const capabilities = await client.listCapabilities();
        return {
            baseUrl: input.baseUrl,
            capabilities,
        };
    } catch (error) {
        const secureBaseUrl = toSecureRuntimeUrl(input.baseUrl);

        if (!secureBaseUrl) {
            throw error;
        }

        const client = createAgentRuntimeClientForConnection({
            ...input,
            baseUrl: secureBaseUrl,
        });
        const capabilities = await client.listCapabilities();
        return {
            baseUrl: secureBaseUrl,
            capabilities,
        };
    }
}

export async function markAgentRuntimeConnectionFailure(input: {
    connectionId: string;
    error: unknown;
}) {
    const record = await getDefaultAgentRuntimeConnection();

    if (!record || record.id !== input.connectionId) {
        return;
    }

    const message = toErrorMessage(input.error);

    await saveStoredAgentRuntimeConnection({
        baseUrl: record.baseUrl,
        enabled: record.enabled,
        id: record.id,
        isActive: record.isActive,
        lastCheckedAt: new Date().toISOString(),
        lastError: message,
        lastSyncedAt: record.lastSyncedAt,
        name: record.name,
    });
}

export async function markAgentRuntimeConnectionReachable(input: { connectionId: string }) {
    const record = await getDefaultAgentRuntimeConnection();

    if (!record || record.id !== input.connectionId) {
        return;
    }

    await saveStoredAgentRuntimeConnection({
        baseUrl: record.baseUrl,
        enabled: record.enabled,
        id: record.id,
        isActive: record.isActive,
        lastCheckedAt: new Date().toISOString(),
        lastError: null,
        lastSyncedAt: record.lastSyncedAt,
        name: record.name,
    });
}

export async function confirmAgentRuntimeConnection() {
    const record = await getDefaultAgentRuntimeConnection();

    if (!record?.enabled) {
        return false;
    }

    try {
        const checked = await checkAgentRuntimeCapabilities(record);
        const runtimeId = checked.capabilities.info.agentRuntimeId;
        const runtimeName = checked.capabilities.info.name;
        await saveStoredAgentRuntimeConnection({
            baseUrl: checked.baseUrl,
            enabled: record.enabled,
            id: runtimeId,
            isActive: true,
            lastCheckedAt: new Date().toISOString(),
            lastError: null,
            lastSyncedAt: record.lastSyncedAt,
            name: runtimeName,
        });
        currentAgentRuntimeUrl = checked.baseUrl;
        return true;
    } catch (error) {
        await markAgentRuntimeConnectionFailure({
            connectionId: record.id,
            error,
        });
        return false;
    }
}
