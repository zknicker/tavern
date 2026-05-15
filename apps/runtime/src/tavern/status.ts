import type { RuntimeStatus } from '@tavern/agent-runtime-protocol';
import { runtimeProtocolVersion } from '@tavern/agent-runtime-protocol';

import { getManagedOpenClawState } from '../openclaw/state';
import { nowIso } from './shared';

function getRuntimeName() {
    return process.env.TAVERN_RUNTIME_NAME?.trim() || 'Tavern Runtime';
}

const managedOpenClawRuntimeId = 'tavern-openclaw-managed';

export function getRuntimeStatus(): RuntimeStatus {
    const managedOpenClaw = getManagedOpenClawState();
    const capabilities = [
        'agentFiles',
        'agentTurns',
        'agents',
        'chats',
        'cron',
        'cronRuns',
        'logs',
        'models',
        'sessionEvents',
        'skills',
        'knowledgebase',
        'memory',
        'tasks',
        ...(managedOpenClaw.tavernPluginPath ? ['tavernPlugin'] : []),
    ] as RuntimeStatus['identity']['capabilities'];

    return {
        health: {
            ok: managedOpenClaw.gatewayReady,
            status: managedOpenClaw.gatewayReady ? 'healthy' : 'starting',
            timestamp: nowIso(),
        },
        identity: {
            capabilities,
            info: {
                name: getRuntimeName(),
                protocolVersion: runtimeProtocolVersion,
                agentRuntimeId: managedOpenClawRuntimeId,
                version: process.env.TAVERN_RUNTIME_VERSION?.trim() || '0.2.0',
            },
        },
    };
}
