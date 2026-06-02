import { syncCodexUsageJob } from './sync-codex-usage-job.ts';
import { syncOpenRouterUsageJob } from './sync-openrouter-usage-job.ts';
import { syncRuntimeSkillsJob } from './sync-runtime-skills-job.ts';

// Jobs are reserved for scheduled operational work. Product reads use Runtime
// storage; jobs keep slow external snapshots fresh.
export const jobDefinitions = [
    syncCodexUsageJob,
    syncOpenRouterUsageJob,
    syncRuntimeSkillsJob,
] as const;

export type RegisteredJobDefinition = (typeof jobDefinitions)[number];
export type RegisteredJobSlug = RegisteredJobDefinition['slug'];
