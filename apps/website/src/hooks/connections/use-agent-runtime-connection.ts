import * as React from 'react';
import { queryPolicy } from '../../lib/query-policy.ts';
import { type AgentRuntimeConnectionOutput, trpc } from '../../lib/trpc.tsx';

export type AgentRuntimeConnectionStatus =
    | 'checking'
    | 'error'
    | 'reachable'
    | 'unconfigured'
    | 'unreachable';

export type AgentRuntimePageConnectionState = 'reachable' | 'unconfigured' | 'unreachable';

export interface AgentRuntimeConnectionState {
    agentRuntimeConnection: AgentRuntimeConnectionOutput;
    connection: AgentRuntimeConnectionOutput;
    isAgentRuntimeConnected: boolean;
    isConnected: boolean;
    status: AgentRuntimeConnectionStatus;
}

export function toAgentRuntimePageConnectionState(
    status: AgentRuntimeConnectionStatus
): AgentRuntimePageConnectionState {
    switch (status) {
        case 'reachable':
            return 'reachable';
        case 'unconfigured':
            return 'unconfigured';
        default:
            return 'unreachable';
    }
}

function deriveAgentRuntimeConnectionStatus(input: {
    hasError: boolean;
    isPending: boolean;
    connection: AgentRuntimeConnectionOutput;
}): AgentRuntimeConnectionStatus {
    if (input.isPending && !input.connection) {
        return 'checking';
    }

    if (input.hasError && !input.connection) {
        return 'error';
    }

    if (!input.connection?.enabled) {
        return 'unconfigured';
    }

    return input.connection.lastError ? 'unreachable' : 'reachable';
}

export function useAgentRuntimeConnection(): AgentRuntimeConnectionState {
    const connectionQuery = trpc.agentRuntime.get.useQuery(undefined, {
        ...queryPolicy.volatileState,
        retry: false,
    });

    return React.useMemo(() => {
        const connection = connectionQuery.data ?? null;
        const status = deriveAgentRuntimeConnectionStatus({
            connection,
            hasError: Boolean(connectionQuery.error),
            isPending: connectionQuery.isPending,
        });

        return {
            connection,
            agentRuntimeConnection: connection,
            isAgentRuntimeConnected: status === 'reachable',
            isConnected: status === 'reachable',
            status,
        };
    }, [connectionQuery.data, connectionQuery.error, connectionQuery.isPending]);
}
