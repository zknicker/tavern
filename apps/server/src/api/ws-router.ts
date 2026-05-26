import { onAgentUpdate } from './agent/on-update.ts';
import { onAgentRuntimeCapabilityUpdated } from './agent-runtime/on-capability-updated.ts';
import { onAgentRuntimeUpdate } from './agent-runtime/on-update.ts';
import { onChatLogUpdate } from './chat/log-on-update.ts';
import { onChatTurnCompleted } from './chat/on-turn-completed.ts';
import { onChatTurnFailed } from './chat/on-turn-failed.ts';
import { onChatTurnProgress } from './chat/on-turn-progress.ts';
import { onChatTurnReplyUpdated } from './chat/on-turn-reply-updated.ts';
import { onChatTurnStarted } from './chat/on-turn-started.ts';
import { onChatUpdate } from './chat/on-update.ts';
import { onCronUpdate } from './cron/on-update.ts';
import { onJobsUpdate } from './jobs/on-update.ts';
import { onModelUpdate } from './model/on-update.ts';
import { onOpenRouterSettingsUpdate } from './openrouter-settings/on-update.ts';
import { onParticipantUpdate } from './participant/on-update.ts';
import { onSessionUpdate } from './session/on-update.ts';
import { onSkillUpdate } from './skill/on-update.ts';
import { createRouter } from './trpc.ts';
import { onLiveUsageUpdate } from './usage/on-live-update.ts';
import { onWorkersUpdate } from './worker/on-update.ts';

export const wsRouter = createRouter({
    agent: createRouter({
        onUpdate: onAgentUpdate,
    }),
    chat: createRouter({
        log: createRouter({
            onUpdate: onChatLogUpdate,
        }),
        onTurnCompleted: onChatTurnCompleted,
        onTurnFailed: onChatTurnFailed,
        onTurnProgress: onChatTurnProgress,
        onTurnReplyUpdated: onChatTurnReplyUpdated,
        onTurnStarted: onChatTurnStarted,
        onUpdate: onChatUpdate,
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
    participant: createRouter({
        onUpdate: onParticipantUpdate,
    }),
    session: createRouter({
        onUpdate: onSessionUpdate,
    }),
    skill: createRouter({
        onUpdate: onSkillUpdate,
    }),
    agentRuntime: createRouter({
        onCapabilityUpdated: onAgentRuntimeCapabilityUpdated,
        onUpdate: onAgentRuntimeUpdate,
    }),
    usage: createRouter({
        onLiveUpdate: onLiveUsageUpdate,
    }),
    worker: createRouter({
        onUpdate: onWorkersUpdate,
    }),
});
