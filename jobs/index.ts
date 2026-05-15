import { checkSkillUpdatesJob } from './check-skill-updates-job.ts';
import { syncRuntimeAgentsJob } from './sync-agent-runtime-agents-job.ts';
import { syncRuntimeChatsJob } from './sync-agent-runtime-chats-job.ts';
import { syncRuntimeConfigJob } from './sync-agent-runtime-config-job.ts';
import { syncRuntimeCronJob } from './sync-agent-runtime-cron-job.ts';
import { syncRuntimeSessionsJob } from './sync-agent-runtime-sessions-job.ts';
import { syncClaudeCodeUsageJob } from './sync-claude-code-usage-job.ts';
import { syncCodexUsageJob } from './sync-codex-usage-job.ts';
import { syncOpenRouterUsageJob } from './sync-openrouter-usage-job.ts';

export const jobDefinitions = [
    checkSkillUpdatesJob,
    syncClaudeCodeUsageJob,
    syncCodexUsageJob,
    syncOpenRouterUsageJob,
    syncRuntimeAgentsJob,
    syncRuntimeConfigJob,
    syncRuntimeChatsJob,
    syncRuntimeSessionsJob,
    syncRuntimeCronJob,
] as const;

export type RegisteredJobDefinition = (typeof jobDefinitions)[number];
export type RegisteredJobSlug = RegisteredJobDefinition['slug'];
