import {
    type AgentRuntimeConnectionStatus,
    useAgentRuntimeConnection,
} from '../../hooks/connections/use-agent-runtime-connection.ts';
import type { AgentRuntimeConnectionOutput } from '../../lib/trpc.tsx';

function getAgentRuntimeTitle(
    status: AgentRuntimeConnectionStatus,
    connection: AgentRuntimeConnectionOutput
) {
    if (connection) {
        return `${status}: ${connection.baseUrl}`;
    }

    if (status === 'checking') {
        return 'Loading Tavern Runtime status.';
    }

    if (status === 'error') {
        return 'Could not load saved Tavern Runtime state.';
    }

    return 'Dashboard is running on synced data only.';
}

export function AgentRuntimeConnectionBadge() {
    const { connection, status } = useAgentRuntimeConnection();
    const isLive = status === 'reachable';
    const isChecking = status === 'checking';

    return (
        <div
            className="pointer-events-auto inline-flex items-center gap-2 font-medium text-muted-foreground text-xs tracking-wide"
            title={getAgentRuntimeTitle(status, connection)}
        >
            <span className="relative flex size-3">
                {isLive && (
                    <span className="absolute inline-flex size-full animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite] rounded-full bg-emerald-400 opacity-60" />
                )}
                <span
                    className={`relative inline-flex size-3 rounded-full ${
                        isLive
                            ? 'bg-emerald-500'
                            : isChecking
                              ? 'animate-pulse bg-muted-foreground/50'
                              : 'bg-muted-foreground/40'
                    }`}
                />
            </span>
            {isLive ? 'LIVE' : 'DISCONNECTED'}
        </div>
    );
}
