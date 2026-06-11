import * as React from 'react';
import { queryPolicy } from '../../lib/query-policy.ts';
import { type AgentRuntimeConnectionOutput, trpc } from '../../lib/trpc.tsx';

export type RuntimeConnectionStatus =
    | 'checking'
    | 'error'
    | 'reachable'
    | 'unconfigured'
    | 'unreachable'
    | 'version-mismatch';

export type RuntimePageConnectionState = 'reachable' | 'unconfigured' | 'unreachable';

export interface RuntimeConnectionState {
    connection: AgentRuntimeConnectionOutput;
    isConnected: boolean;
    status: RuntimeConnectionStatus;
}

export function toRuntimePageConnectionState(
    status: RuntimeConnectionStatus
): RuntimePageConnectionState {
    switch (status) {
        case 'reachable':
            return 'reachable';
        case 'unconfigured':
            return 'unconfigured';
        default:
            return 'unreachable';
    }
}

function deriveRuntimeConnectionStatus(input: {
    hasError: boolean;
    isPending: boolean;
    connection: AgentRuntimeConnectionOutput;
}): RuntimeConnectionStatus {
    if (input.isPending && !input.connection) {
        return 'checking';
    }

    if (input.hasError && !input.connection) {
        return 'error';
    }

    if (!input.connection?.enabled) {
        return 'unconfigured';
    }

    if (input.connection.lastError) {
        return 'unreachable';
    }

    if (input.connection.runtimeVersion === null && input.connection.capabilities.length === 0) {
        return 'checking';
    }

    return input.connection.runtimeVersion && input.connection.versionStatus === 'mismatched'
        ? 'version-mismatch'
        : 'reachable';
}

export function useRuntimeConnection(): RuntimeConnectionState {
    const connectionQuery = trpc.agentRuntime.get.useQuery(undefined, {
        ...queryPolicy.volatileState,
        retry: false,
    });

    return React.useMemo(() => {
        const connection = connectionQuery.data ?? null;
        const status = deriveRuntimeConnectionStatus({
            connection,
            hasError: Boolean(connectionQuery.error),
            isPending: connectionQuery.isPending,
        });

        return {
            connection,
            isConnected: status === 'reachable',
            status,
        };
    }, [connectionQuery.data, connectionQuery.error, connectionQuery.isPending]);
}
