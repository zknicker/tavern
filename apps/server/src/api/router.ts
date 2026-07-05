import { agentRouter } from './agent/router.ts';
import { agentRuntimeRouter } from './agent-runtime/router.ts';
import { chatRouter } from './chat/router.ts';
import { cronRouter } from './cron/router.ts';
import { devRouter } from './dev/router.ts';
import { jobsRouter } from './jobs/router.ts';
import { logRouter } from './log/router.ts';
import { mcpRouter } from './mcp/router.ts';
import { memoryRouter } from './memory/router.ts';
import { mentionRouter } from './mention/router.ts';
import { messagingPlatformRouter } from './messaging-platform/router.ts';
import { modelRouter } from './model/router.ts';
import { modelAccessRouter } from './model-access/router.ts';
import { openAiSettingsRouter } from './openai-settings/router.ts';
import { openRouterSettingsRouter } from './openrouter-settings/router.ts';
import { participantRouter } from './participant/router.ts';
import { pluginRouter } from './plugin/router.ts';
import { semanticMemoryRouter } from './semantic-memory/router.ts';
import { sessionRouter } from './session/router.ts';
import { skillRouter } from './skill/router.ts';
import { subAgentRouter } from './sub-agent/router.ts';
import { timezoneRouter } from './timezone/router.ts';
import { createRouter } from './trpc.ts';
import { usageRouter } from './usage/router.ts';
import { workerRouter } from './worker/router.ts';

export const appRouter = createRouter({
    agent: agentRouter,
    chat: chatRouter,
    mcp: mcpRouter,
    cron: cronRouter,
    dev: devRouter,
    jobs: jobsRouter,
    log: logRouter,
    mention: mentionRouter,
    memory: memoryRouter,
    messagingPlatform: messagingPlatformRouter,
    modelAccess: modelAccessRouter,
    model: modelRouter,
    openAiSettings: openAiSettingsRouter,
    openRouterSettings: openRouterSettingsRouter,
    participant: participantRouter,
    plugin: pluginRouter,
    agentRuntime: agentRuntimeRouter,
    session: sessionRouter,
    skill: skillRouter,
    subAgent: subAgentRouter,
    timezone: timezoneRouter,
    usage: usageRouter,
    semanticMemory: semanticMemoryRouter,
    worker: workerRouter,
});

export type AppRouter = typeof appRouter;
