import { agentRouter } from './agent/router.ts';
import { agentRuntimeRouter } from './agent-runtime/router.ts';
import { chatRouter } from './chat/router.ts';
import { cronRouter } from './cron/router.ts';
import { devRouter } from './dev/router.ts';
import { identityRouter } from './identity/router.ts';
import { jobsRouter } from './jobs/router.ts';
import { labelsRouter } from './labels/router.ts';
import { logRouter } from './log/router.ts';
import { mcpRouter } from './mcp/router.ts';
import { memoryRouter } from './memory/router.ts';
import { mentionRouter } from './mention/router.ts';
import { messagingPlatformRouter } from './messaging-platform/router.ts';
import { modelRouter } from './model/router.ts';
import { modelAccessRouter } from './model-access/router.ts';
import { openAiSettingsRouter } from './openai-settings/router.ts';
import { openRouterSettingsRouter } from './openrouter-settings/router.ts';
import { paneRouter } from './pane/router.ts';
import { participantRouter } from './participant/router.ts';
import { pluginRouter } from './plugin/router.ts';
import { sessionRouter } from './session/router.ts';
import { skillRouter } from './skill/router.ts';
import { subAgentRouter } from './sub-agent/router.ts';
import { tasksRouter } from './tasks/router.ts';
import { threadRouter } from './thread/router.ts';
import { timezoneRouter } from './timezone/router.ts';
import { createRouter } from './trpc.ts';
import { usageRouter } from './usage/router.ts';
import { wikiRouter } from './wiki/router.ts';
import { workerRouter } from './worker/router.ts';

export const appRouter = createRouter({
    agent: agentRouter,
    identity: identityRouter,
    chat: chatRouter,
    mcp: mcpRouter,
    cron: cronRouter,
    dev: devRouter,
    jobs: jobsRouter,
    labels: labelsRouter,
    log: logRouter,
    mention: mentionRouter,
    memory: memoryRouter,
    messagingPlatform: messagingPlatformRouter,
    modelAccess: modelAccessRouter,
    model: modelRouter,
    openAiSettings: openAiSettingsRouter,
    openRouterSettings: openRouterSettingsRouter,
    pane: paneRouter,
    participant: participantRouter,
    plugin: pluginRouter,
    agentRuntime: agentRuntimeRouter,
    session: sessionRouter,
    skill: skillRouter,
    subAgent: subAgentRouter,
    tasks: tasksRouter,
    thread: threadRouter,
    timezone: timezoneRouter,
    usage: usageRouter,
    wiki: wikiRouter,
    worker: workerRouter,
});

export type AppRouter = typeof appRouter;
