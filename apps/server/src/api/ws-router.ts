import { onAgentUpdate } from './agent/on-update.ts';
import { onAgentRuntimeCapabilityUpdated } from './agent-runtime/on-capability-updated.ts';
import { onAgentRuntimeUpdate } from './agent-runtime/on-update.ts';
import { onChatTurnCompleted } from './chat/on-turn-completed.ts';
import { onChatTurnFailed } from './chat/on-turn-failed.ts';
import { onChatTurnProgress } from './chat/on-turn-progress.ts';
import { onChatTurnReplyUpdated } from './chat/on-turn-reply-updated.ts';
import { onChatTurnStarted } from './chat/on-turn-started.ts';
import { onCronUpdate } from './cron/on-update.ts';
import { onJobsUpdate } from './jobs/on-update.ts';
import { onModelUpdate } from './model/on-update.ts';
import { onOpenRouterSettingsUpdate } from './openrouter-settings/on-update.ts';
import { onSkillUpdate } from './skill/on-update.ts';
import { onDataUpdate } from './sync/on-data-update.ts';
import { createRouter } from './trpc.ts';
import { onLiveUsageUpdate } from './usage/on-live-update.ts';
import { onWorkersUpdate } from './worker/on-update.ts';

export const wsRouter = createRouter({
    agent: createRouter({
        onUpdate: onAgentUpdate,
    }),
    chat: createRouter({
        onTurnCompleted: onChatTurnCompleted,
        onTurnFailed: onChatTurnFailed,
        onTurnProgress: onChatTurnProgress,
        onTurnReplyUpdated: onChatTurnReplyUpdated,
        onTurnStarted: onChatTurnStarted,
    }),
    jobs: createRouter({
        onUpdate: onJobsUpdate,
    }),
    model: createRouter({
        onUpdate: onModelUpdate,
    }),
    cron: createRouter({
        onUpdate: onCronUpdate,
    }),
    openRouterSettings: createRouter({
        onUpdate: onOpenRouterSettingsUpdate,
    }),
    skill: createRouter({
        onUpdate: onSkillUpdate,
    }),
    agentRuntime: createRouter({
        onCapabilityUpdated: onAgentRuntimeCapabilityUpdated,
        onUpdate: onAgentRuntimeUpdate,
    }),
    sync: createRouter({
        onDataUpdate,
    }),
    usage: createRouter({
        onLiveUpdate: onLiveUsageUpdate,
    }),
    worker: createRouter({
        onUpdate: onWorkersUpdate,
    }),
});
