import { type RuntimeHealth, type RuntimeInfo, runtimeProtocolVersion } from '@tavern/api';
import runtimePackage from '../../package.json';
import { nowIso } from './shared';

function getRuntimeName() {
    return process.env.TAVERN_RUNTIME_NAME?.trim() || 'Grotto Runtime';
}

const managedAgentEngineRuntimeId = 'tavern-agent-engine';

export function getRuntimeHealth(): RuntimeHealth {
    return {
        ok: true,
        status: 'healthy',
        timestamp: nowIso(),
    };
}

export function getRuntimeInfo(): RuntimeInfo {
    return {
        agentRuntimeId: managedAgentEngineRuntimeId,
        name: getRuntimeName(),
        protocolVersion: runtimeProtocolVersion,
        version: process.env.TAVERN_RUNTIME_VERSION?.trim() || runtimePackage.version,
    };
}
