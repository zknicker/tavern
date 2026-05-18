import {
    type AgentRuntimeStatus,
    agentRuntimeProtocolVersion,
    agentRuntimeStatusSchema,
} from '@tavern/api';
import { asRecord, nowIso, readString } from '../../gateway/records.ts';

export function mapOpenClawStatus(input: { health: unknown; status: unknown }): AgentRuntimeStatus {
    const health = asRecord(input.health);
    const status = asRecord(input.status);
    const version =
        readString(status, ['version', 'gatewayVersion', 'runtimeVersion']) ?? 'unknown';
    const rawStatus = readString(health, ['status', 'state']) ?? 'healthy';

    return agentRuntimeStatusSchema.parse({
        health: {
            ok: rawStatus !== 'error' && rawStatus !== 'unhealthy',
            status:
                rawStatus === 'starting'
                    ? 'starting'
                    : rawStatus === 'degraded'
                      ? 'degraded'
                      : 'healthy',
            timestamp: nowIso(),
        },
        identity: {
            capabilities: [
                'agentTurns',
                'agentFiles',
                'agents',
                'chats',
                'cron',
                'cronRuns',
                'logs',
                'models',
                'sessionEvents',
                'skills',
            ],
            info: {
                agentRuntimeId: readString(status, ['id', 'gatewayId', 'profile']) ?? 'openclaw',
                name: readString(status, ['name', 'profileName']) ?? 'OpenClaw',
                protocolVersion: agentRuntimeProtocolVersion,
                version,
            },
        },
    });
}
