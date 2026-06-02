import { useAgentEvents } from '../hooks/agents/use-agent-events.ts';
import { useChatEvents } from '../hooks/chats/use-chat-events.ts';
import { useChatTurnEvents } from '../hooks/chats/use-chat-turn-events.ts';
import {
    useAgentRuntimeCapabilityEvents,
    useAgentRuntimeConnectionEvents,
} from '../hooks/connections/use-agent-runtime-connection-events.ts';
import { useOpenRouterSettingsEvents } from '../hooks/connections/use-openrouter-settings-events.ts';
import { useCronEvents } from '../hooks/cron/use-cron-events.ts';
import { useModelEvents } from '../hooks/models/use-model-events.ts';
import { useUsageEvents } from '../hooks/models/use-usage-events.ts';
import { useOpenClawConfigEvents } from '../hooks/openclaw-config/use-openclaw-config-events.ts';
import { useParticipantEvents } from '../hooks/participants/use-participant-events.ts';
import { useSessionEvents } from '../hooks/sessions/use-session-events.ts';
import { useSkillEvents } from '../hooks/skills/use-events.ts';
import { useWorkerEvents } from '../hooks/workers/use-worker-events.ts';

export function TrpcEventListeners() {
    useAgentEvents();
    useChatEvents();
    useChatTurnEvents();
    useAgentRuntimeCapabilityEvents();
    useAgentRuntimeConnectionEvents();
    useCronEvents();
    useModelEvents();
    useOpenRouterSettingsEvents();
    useOpenClawConfigEvents();
    useParticipantEvents();
    useSessionEvents();
    useSkillEvents();
    useUsageEvents();
    useWorkerEvents();

    return null;
}
