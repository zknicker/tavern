import {
    agentRuntimeCapabilityHealthListSchema,
    agentRuntimeRoutes,
    agentRuntimeUpdateSchema,
} from '@tavern/api';
import type { z } from 'zod';
import { getRuntimeApiToken, getRuntimePort } from '../config';

const PROBE_TIMEOUT_MS = 1500;

/**
 * Base URL for update/restart probes. These flows always target the local brew
 * service and never honor TAVERN_RUNTIME_URL (spec: "Global conventions").
 */
export function localRuntimeUrl(): string {
    return `http://127.0.0.1:${getRuntimePort()}`;
}

/** Capability rows from GET /capabilities. */
export type RuntimeCapability = z.infer<
    typeof agentRuntimeCapabilityHealthListSchema
>['capabilities'][number];

/** A combined liveness + version + capability snapshot for `grotto status`. */
export interface RuntimeSnapshot {
    /** Capability rows, or null when the runtime is unreachable. */
    capabilities: RuntimeCapability[] | null;
    /** Health string ('healthy' | 'degraded' | 'starting'), or null. */
    health: string | null;
    /** True when any probe reached the runtime. */
    reachable: boolean;
    /** Running version from GET /update/status, or null. */
    version: string | null;
}

/**
 * Status-screen probe: gathers update status, health, and capabilities from a
 * runtime URL (honoring TAVERN_RUNTIME_URL / --runtime-url). Tolerant: every
 * sub-probe failure degrades to null rather than throwing, so a down runtime
 * still yields a renderable snapshot.
 */
export async function probeRuntimeSnapshot(baseUrl: string): Promise<RuntimeSnapshot> {
    const [update, health, caps] = await Promise.all([
        probeJsonAt(baseUrl, agentRuntimeRoutes.updateStatus, PROBE_TIMEOUT_MS),
        probeJsonAt(baseUrl, agentRuntimeRoutes.health, PROBE_TIMEOUT_MS),
        probeJsonAt(baseUrl, agentRuntimeRoutes.capabilities, PROBE_TIMEOUT_MS),
    ]);

    const parsedUpdate = update === null ? null : agentRuntimeUpdateSchema.safeParse(update);
    const version = parsedUpdate?.success ? parsedUpdate.data.currentVersion : null;

    const healthStatus = readHealthStatus(health);

    const parsedCaps =
        caps === null ? null : agentRuntimeCapabilityHealthListSchema.safeParse(caps);
    const capabilities = parsedCaps?.success ? parsedCaps.data.capabilities : null;

    return {
        version,
        health: healthStatus,
        capabilities,
        reachable: update !== null || health !== null || caps !== null,
    };
}

function readHealthStatus(data: unknown): string | null {
    if (!(data && typeof data === 'object')) {
        return null;
    }
    const record = data as Record<string, unknown>;
    if (typeof record.status === 'string') {
        return record.status;
    }
    return record.ok === true ? 'healthy' : null;
}

export interface RuntimeProbe {
    /** Running version from GET /update/status, or null when unreachable. */
    currentVersion(): Promise<string | null>;
    /** True when GET /health returns ok. */
    health(): Promise<boolean>;
}

export const runtimeProbe: RuntimeProbe = {
    async health() {
        const data = await probeJson(agentRuntimeRoutes.health, PROBE_TIMEOUT_MS);
        if (!(data && typeof data === 'object')) {
            return false;
        }
        const record = data as Record<string, unknown>;
        return record.ok === true || record.status === 'healthy';
    },
    async currentVersion() {
        const data = await probeJson(agentRuntimeRoutes.updateStatus, PROBE_TIMEOUT_MS);
        if (data === null) {
            return null;
        }
        const parsed = agentRuntimeUpdateSchema.safeParse(data);
        return parsed.success ? parsed.data.currentVersion : null;
    },
};

/**
 * Fast running-version probe for bare `tavern` (~750 ms). Returns null when the
 * runtime is unreachable or the timeout fires, so the banner falls back to
 * "not running" instead of stalling.
 */
export async function probeRunningVersion(timeoutMs = 750): Promise<string | null> {
    const data = await probeJson(agentRuntimeRoutes.updateStatus, timeoutMs);
    if (data === null) {
        return null;
    }
    const parsed = agentRuntimeUpdateSchema.safeParse(data);
    return parsed.success ? parsed.data.currentVersion : null;
}

function probeJson(route: string, timeoutMs: number): Promise<unknown> {
    return probeJsonAt(localRuntimeUrl(), route, timeoutMs);
}

function resolveProbeAuthHeaders(): Record<string, string> {
    try {
        const token = getRuntimeApiToken();
        return token ? { authorization: `Bearer ${token}` } : {};
    } catch {
        return {};
    }
}

async function probeJsonAt(baseUrl: string, route: string, timeoutMs: number): Promise<unknown> {
    try {
        const response = await fetch(new URL(route, baseUrl), {
            headers: resolveProbeAuthHeaders(),
            method: 'GET',
            signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok) {
            return null;
        }
        return await response.json();
    } catch {
        return null;
    }
}
