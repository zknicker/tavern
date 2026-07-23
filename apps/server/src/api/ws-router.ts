import { onEngineRestart } from './agent/on-engine-restart.ts';
import { onAgentInstructionsUpdate } from './agent/on-instructions-update.ts';
import { onAgentUpdate } from './agent/on-update.ts';
import { onAgentRuntimeCapabilityUpdated } from './agent-runtime/on-capability-updated.ts';
import { onAgentRuntimeUpdate } from './agent-runtime/on-update.ts';
import { onChatLogUpdate } from './chat/log-on-update.ts';
import { onChatComposition } from './chat/on-composition.ts';
import { onChatUpdate } from './chat/on-update.ts';
import { onJobsUpdate } from './jobs/on-update.ts';
import { onLabelsUpdate } from './label/on-update.ts';
import { onModelUpdate } from './model/on-update.ts';
import { onOpenRouterSettingsUpdate } from './openrouter-settings/on-update.ts';
import { onPaneUpdate } from './pane/on-update.ts';
import { onRemindersUpdate } from './reminder/on-update.ts';
import { onSessionUpdate } from './session/on-update.ts';
import { onSkillUpdate } from './skill/on-update.ts';
import { onTasksUpdate } from './task/on-update.ts';
import { createRouter } from './trpc.ts';
import { onLiveUsageUpdate } from './usage/on-live-update.ts';
import { onWorkersUpdate } from './worker/on-update.ts';

export const wsRouter = createRouter({
    agent: createRouter({
        onEngineRestart,
        onInstructionsUpdate: onAgentInstructionsUpdate,
        onUpdate: onAgentUpdate,
    }),
    chat: createRouter({
        onComposition: onChatComposition,
        log: createRouter({
            onUpdate: onChatLogUpdate,
        }),
        onUpdate: onChatUpdate,
    }),
    jobs: createRouter({
        onUpdate: onJobsUpdate,
    }),
    label: createRouter({
        onUpdate: onLabelsUpdate,
    }),
    model: createRouter({
        onUpdate: onModelUpdate,
    }),
    openRouterSettings: createRouter({
        onUpdate: onOpenRouterSettingsUpdate,
    }),
    pane: createRouter({
        onUpdate: onPaneUpdate,
    }),
    reminder: createRouter({
        onUpdate: onRemindersUpdate,
    }),
    session: createRouter({
        onUpdate: onSessionUpdate,
    }),
    skill: createRouter({
        onUpdate: onSkillUpdate,
    }),
    task: createRouter({
        onUpdate: onTasksUpdate,
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
