import { syncCodexUsageJob } from './sync-codex-usage-job.ts';
import { syncOpenRouterUsageJob } from './sync-openrouter-usage-job.ts';

// Jobs are reserved for scheduled operational work. Runtime product state is
// read from Runtime storage and refreshed by domain ingestion/events.
export const jobDefinitions = [syncCodexUsageJob, syncOpenRouterUsageJob] as const;

export type RegisteredJobDefinition = (typeof jobDefinitions)[number];
export type RegisteredJobSlug = RegisteredJobDefinition['slug'];
