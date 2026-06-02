import * as React from 'react';
import type { AgentRuntimeConnectionOutput } from '../../lib/trpc.tsx';
import { useAgentRuntimeConnection } from './use-agent-runtime-connection.ts';

type RuntimeConnection = NonNullable<AgentRuntimeConnectionOutput>;
type RuntimeCapabilityStatus = RuntimeConnection['runtimeCapabilities'][number];

export type RuntimeCapabilityId = RuntimeCapabilityStatus['capability'];

interface RuntimeCapabilityView {
    healthy: boolean;
    reason: string | null;
    state: RuntimeCapabilityStatus['state'];
    status: RuntimeCapabilityStatus | null;
}

export function getAgentRuntimeCapability(
    connection: AgentRuntimeConnectionOutput,
    capability: RuntimeCapabilityId
): RuntimeCapabilityView {
    const status =
        connection?.runtimeCapabilities.find((record) => record.capability === capability) ?? null;

    return {
        healthy: status?.state === 'healthy',
        reason: status?.reason ?? null,
        state: status?.state ?? 'unknown',
        status,
    };
}

export function useAgentRuntimeCapability(capability: RuntimeCapabilityId) {
    const agentRuntimeConnection = useAgentRuntimeConnection();

    return React.useMemo(
        () => getAgentRuntimeCapability(agentRuntimeConnection.connection, capability),
        [agentRuntimeConnection.connection, capability]
    );
}
