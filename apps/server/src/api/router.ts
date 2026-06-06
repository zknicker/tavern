import { agentRouter } from './agent/router.ts';
import { agentRuntimeRouter } from './agent-runtime/router.ts';
import { chatRouter } from './chat/router.ts';
import { cortexRouter } from './cortex/router.ts';
import { cronRouter } from './cron/router.ts';
import { highlightRouter } from './highlight/router.ts';
import { jobsRouter } from './jobs/router.ts';
import { logRouter } from './log/router.ts';
import { mentionRouter } from './mention/router.ts';
import { messagingPlatformRouter } from './messaging-platform/router.ts';
import { modelRouter } from './model/router.ts';
import { modelAccessRouter } from './model-access/router.ts';
import { openAiSettingsRouter } from './openai-settings/router.ts';
import { openClawConfigRouter } from './openclaw-config/router.ts';
import { openRouterSettingsRouter } from './openrouter-settings/router.ts';
import { participantRouter } from './participant/router.ts';
import { sessionRouter } from './session/router.ts';
import { skillRouter } from './skill/router.ts';
import { subAgentRouter } from './sub-agent/router.ts';
import { createRouter } from './trpc.ts';
import { usageRouter } from './usage/router.ts';
import { workerRouter } from './worker/router.ts';

export const appRouter = createRouter({
    agent: agentRouter,
    chat: chatRouter,
    cron: cronRouter,
    highlight: highlightRouter,
    cortex: cortexRouter,
    jobs: jobsRouter,
    log: logRouter,
    mention: mentionRouter,
    messagingPlatform: messagingPlatformRouter,
    modelAccess: modelAccessRouter,
    model: modelRouter,
    openAiSettings: openAiSettingsRouter,
    openClawConfig: openClawConfigRouter,
    openRouterSettings: openRouterSettingsRouter,
    participant: participantRouter,
    agentRuntime: agentRuntimeRouter,
    session: sessionRouter,
    skill: skillRouter,
    subAgent: subAgentRouter,
    usage: usageRouter,
    worker: workerRouter,
});

export type AppRouter = typeof appRouter;
