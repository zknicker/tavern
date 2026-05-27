import { useAgentRuntimeConnection } from '../../../hooks/connections/use-agent-runtime-connection.ts';
import { useAgentRuntimeCapabilityEvents } from '../../../hooks/connections/use-agent-runtime-connection-events.ts';
import { AgentRuntimeSettingsPanel } from './agent-runtime-panel.tsx';

export function AgentRuntimeSettings() {
    useAgentRuntimeCapabilityEvents();
    const runtime = useAgentRuntimeConnection();

    if (runtime.status === 'checking') {
        return <p className="text-muted-foreground text-sm">Loading Tavern Runtime...</p>;
    }

    return <AgentRuntimeSettingsPanel runtime={runtime.connection} />;
}
