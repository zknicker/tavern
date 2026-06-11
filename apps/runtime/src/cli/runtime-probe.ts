import { agentRuntimeRoutes, agentRuntimeUpdateSchema } from '@tavern/api';
import { getRuntimePort } from '../config';

const PROBE_TIMEOUT_MS = 1500;

/**
 * Base URL for update/restart probes. These flows always target the local brew
 * service and never honor TAVERN_RUNTIME_URL (spec: "Global conventions").
 */
export function localRuntimeUrl(): string {
    return `http://127.0.0.1:${getRuntimePort()}`;
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

async function probeJson(route: string, timeoutMs: number): Promise<unknown> {
    try {
        const response = await fetch(new URL(route, localRuntimeUrl()), {
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
