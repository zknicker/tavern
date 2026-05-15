import type { AgentRuntimeCapability } from '@tavern/agent-runtime-protocol';

export const openClawAgentRuntimeCapabilities = [
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
] as const satisfies AgentRuntimeCapability[];
