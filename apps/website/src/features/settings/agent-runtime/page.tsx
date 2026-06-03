import { useRuntimeConnection } from '../../../hooks/connections/use-runtime-connection.ts';
import { useRuntimeCapabilityEvents } from '../../../hooks/connections/use-runtime-events.ts';
import { AgentRuntimeSettingsPanel } from './agent-runtime-panel.tsx';

export function AgentRuntimeSettings() {
    useRuntimeCapabilityEvents();
    const runtime = useRuntimeConnection();

    if (runtime.status === 'checking') {
        return <p className="text-muted-foreground text-sm">Loading Tavern Runtime...</p>;
    }

    return <AgentRuntimeSettingsPanel runtime={runtime.connection} />;
}
