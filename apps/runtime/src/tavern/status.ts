import { type RuntimeHealth, type RuntimeInfo, runtimeProtocolVersion } from '@tavern/api';
import runtimePackage from '../../package.json';
import { nowIso } from './shared';

function getRuntimeName() {
    return process.env.TAVERN_RUNTIME_NAME?.trim() || 'Tavern Runtime';
}

const managedOpenClawRuntimeId = 'tavern-openclaw-managed';

export function getRuntimeHealth(): RuntimeHealth {
    return {
        ok: true,
        status: 'healthy',
        timestamp: nowIso(),
    };
}

export function getRuntimeInfo(): RuntimeInfo {
    return {
        agentRuntimeId: managedOpenClawRuntimeId,
        name: getRuntimeName(),
        protocolVersion: runtimeProtocolVersion,
        version: process.env.TAVERN_RUNTIME_VERSION?.trim() || runtimePackage.version,
    };
}
