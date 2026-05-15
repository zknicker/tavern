import {
    recordCapabilityFailure,
    recordCapabilitySuccess,
} from '../agent-runtime/capability-status.ts';
import { createAgentRuntimeClientForConnection } from '../agent-runtime/client-factory.ts';
import { checkSkillMaterializationCapability } from '../skills/capability.ts';
import { listAgentRuntimeCapabilityStatuses } from '../storage/agent-runtime-capability-status.ts';
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
import { splitAgentRuntimeCapabilities } from './capability-groups.ts';
import type { AgentRuntimeConnection } from './contracts.ts';
import { recordOpenClawGatewayCapability } from './openclaw-gateway-capability.ts';
import { recordTavernPluginCapability } from './tavern-plugin-capability.ts';

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
    source: 'environment' | 'saved';
}): AgentRuntimeConnection {
    const capabilities = input.capabilities ?? [];
    const capabilityGroups = splitAgentRuntimeCapabilities(capabilities);

    return {
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
        openClawCapabilities: capabilityGroups.openClawCapabilities,
        runtimeCapabilities: capabilityGroups.runtimeCapabilities,
        source: input.source,
    };
}

async function toSavedAgentRuntimeConnection(
    record: Awaited<ReturnType<typeof getDefaultAgentRuntimeConnection>>
): Promise<AgentRuntimeConnection | null> {
    if (!record) {
        return null;
    }

    return toAgentRuntimeConnection({
        authConfigured: parseAgentRuntimeConnectionAuth(record.authJson) !== null,
        baseUrl: record.baseUrl,
        capabilities: await listAgentRuntimeCapabilityStatuses(record.id),
        enabled: record.enabled,
        id: record.id,
        isActive: record.isActive,
        lastCheckedAt: record.lastCheckedAt,
        lastError: record.lastError,
        lastSyncedAt: record.lastSyncedAt,
        name: record.name,
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
            id: checked.status.identity.info.agentRuntimeId,
            isActive: true,
            lastCheckedAt: null,
            lastError: null,
            name: checked.status.identity.info.name,
        });
        currentAgentRuntimeUrl = checked.baseUrl;

        return toAgentRuntimeConnection({
            baseUrl: checked.baseUrl,
            authConfigured: false,
            enabled: true,
            id: record?.id ?? checked.status.identity.info.agentRuntimeId,
            isActive: true,
            lastCheckedAt: null,
            lastError: null,
            lastSyncedAt: null,
            name: checked.status.identity.info.name,
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

        return toAgentRuntimeConnection({
            baseUrl: environmentBaseUrl,
            authConfigured: false,
            enabled: true,
            id: runtimeId,
            isActive: true,
            capabilities: await listAgentRuntimeCapabilityStatuses(runtimeId),
            lastCheckedAt: environmentRecord?.lastCheckedAt ?? null,
            lastError: environmentRecord?.lastError ?? null,
            lastSyncedAt: environmentRecord?.lastSyncedAt ?? null,
            name: 'Tavern Runtime',
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
    const checked = await checkAgentRuntimeConnection({
        auth: input.auth,
        baseUrl: input.baseUrl,
    });
    const record = await saveStoredAgentRuntimeConnection({
        auth,
        baseUrl: checked.baseUrl,
        enabled: input.enabled,
        id: input.id ?? checked.status.identity.info.agentRuntimeId,
        isActive: true,
        lastCheckedAt: checkedAt,
        lastError: input.lastError,
        name: checked.status.identity.info.name,
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
    return await checkAgentRuntimeStatus({
        authJson: auth ? JSON.stringify(auth) : null,
        baseUrl: input.baseUrl,
    });
}

async function checkAgentRuntimeStatus(input: { authJson?: null | string; baseUrl: string }) {
    try {
        const client = createAgentRuntimeClientForConnection(input);
        const status = await client.getStatus();
        return {
            baseUrl: input.baseUrl,
            status,
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
        const status = await client.getStatus();
        return {
            baseUrl: secureBaseUrl,
            status,
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

    await recordCapabilityFailure({
        capability: 'status',
        error: input.error,
        method: 'health/status',
        runtimeId: record.id,
    });
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

    await recordCapabilitySuccess({
        capability: 'status',
        method: 'health/status',
        runtimeId: record.id,
    });
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
        const checked = await checkAgentRuntimeStatus(record);
        const runtimeId = checked.status.identity.info.agentRuntimeId;
        const runtimeName = checked.status.identity.info.name;
        const client = createAgentRuntimeClientForConnection({
            ...record,
            baseUrl: checked.baseUrl,
        });
        await recordCapabilitySuccess({
            capability: 'status',
            method: 'health/status',
            runtimeId,
        });
        await recordTavernPluginCapability({
            runtimeId,
            status: checked.status,
        });
        await recordOpenClawGatewayCapability({ client, runtimeId });
        await checkSkillMaterializationCapability({
            client,
            runtimeId,
        });
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
