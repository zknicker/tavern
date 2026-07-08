import { onEngineRestart } from './agent/on-engine-restart.ts';
import { onAgentInstructionsUpdate } from './agent/on-instructions-update.ts';
import { onAgentUpdate } from './agent/on-update.ts';
import { onAgentRuntimeCapabilityUpdated } from './agent-runtime/on-capability-updated.ts';
import { onAgentRuntimeUpdate } from './agent-runtime/on-update.ts';
import { onChatLogUpdate } from './chat/log-on-update.ts';
import { onChatTurnCancelled } from './chat/on-turn-cancelled.ts';
import { onChatTurnCompleted } from './chat/on-turn-completed.ts';
import { onChatTurnFailed } from './chat/on-turn-failed.ts';
import { onChatTurnProgress } from './chat/on-turn-progress.ts';
import { onChatTurnReplyUpdated } from './chat/on-turn-reply-updated.ts';
import { onChatTurnStarted } from './chat/on-turn-started.ts';
import { onChatTurnStatusUpdated } from './chat/on-turn-status-updated.ts';
import { onChatUpdate } from './chat/on-update.ts';
import { onCronUpdate } from './cron/on-update.ts';
import { onJobsUpdate } from './jobs/on-update.ts';
import { onModelUpdate } from './model/on-update.ts';
import { onOpenRouterSettingsUpdate } from './openrouter-settings/on-update.ts';
import { onSessionUpdate } from './session/on-update.ts';
import { onSkillUpdate } from './skill/on-update.ts';
import { onTasksUpdate } from './tasks/on-update.ts';
import { createRouter } from './trpc.ts';
import { onLiveUsageUpdate } from './usage/on-live-update.ts';
import { onWikiUpdate } from './wiki/on-update.ts';
import { onWorkersUpdate } from './worker/on-update.ts';

export const wsRouter = createRouter({
    agent: createRouter({
        onEngineRestart,
        onInstructionsUpdate: onAgentInstructionsUpdate,
        onUpdate: onAgentUpdate,
    }),
    chat: createRouter({
        log: createRouter({
            onUpdate: onChatLogUpdate,
        }),
        onTurnCompleted: onChatTurnCompleted,
        onTurnCancelled: onChatTurnCancelled,
        onTurnFailed: onChatTurnFailed,
        onTurnProgress: onChatTurnProgress,
        onTurnReplyUpdated: onChatTurnReplyUpdated,
        onTurnStarted: onChatTurnStarted,
        onTurnStatusUpdated: onChatTurnStatusUpdated,
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
    session: createRouter({
        onUpdate: onSessionUpdate,
    }),
    skill: createRouter({
        onUpdate: onSkillUpdate,
    }),
    tasks: createRouter({
        onUpdate: onTasksUpdate,
    }),
    agentRuntime: createRouter({
        onCapabilityUpdated: onAgentRuntimeCapabilityUpdated,
        onUpdate: onAgentRuntimeUpdate,
    }),
    usage: createRouter({
        onLiveUpdate: onLiveUsageUpdate,
    }),
    wiki: createRouter({
        onUpdate: onWikiUpdate,
    }),
    worker: createRouter({
        onUpdate: onWorkersUpdate,
    }),
});
