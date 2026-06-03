import { z } from 'zod';
import { jobDefinitions } from '../../../../jobs/index.ts';

const jobSlugs = jobDefinitions.map((definition) => definition.slug);
export const runtimeJobSlugs = [
    'cortex-dream',
    'cortex-generate-embeddings',
    'cortex-lint',
    'cortex-maintenance',
    'cortex-signal',
    'cortex-sync',
    'refresh-runtime-capabilities',
    'tavern-highlights',
] as const;
const allJobSlugs = [...jobSlugs, ...runtimeJobSlugs];

if (allJobSlugs.length === 0) {
    throw new Error('At least one job definition must be registered.');
}

const [firstJobSlug, ...remainingJobSlugs] = allJobSlugs;

export const jobSlugSchema = z.enum([firstJobSlug, ...remainingJobSlugs]);

export const jobAvailabilitySchema = z.enum(['disabled', 'enabled']);

export const jobRunStateSchema = z.enum([
    'active',
    'completed',
    'delayed',
    'failed',
    'unknown',
    'waiting',
]);

export const jobCountsSchema = z.object({
    active: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    delayed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    waiting: z.number().int().nonnegative(),
});

export const jobScheduleSchema = z.discriminatedUnion('kind', [
    z.object({
        kind: z.literal('manual'),
    }),
    z.object({
        everyMs: z.number().int().positive(),
        kind: z.literal('interval'),
        nextRunAt: z.string().nullable(),
        runOnStart: z.boolean(),
    }),
]);

export const jobRunSummarySchema = z.object({
    attemptsMade: z.number().int().nonnegative(),
    createdAt: z.string(),
    durationMs: z.number().int().nonnegative().nullable(),
    error: z.string().nullable(),
    finishedAt: z.string().nullable(),
    id: z.string(),
    progress: z.number().int().nonnegative(),
    startedAt: z.string().nullable(),
    state: jobRunStateSchema,
});

export const jobRunDetailSchema = jobRunSummarySchema.extend({
    logs: z.array(z.string()),
});

export const jobSummarySchema = z.object({
    availability: jobAvailabilitySchema,
    counts: jobCountsSchema,
    description: z.string(),
    disabledReason: z.string().nullable().default(null),
    displayName: z.string(),
    latestRun: jobRunSummarySchema.nullable(),
    queueName: z.string(),
    schedule: jobScheduleSchema,
    slug: jobSlugSchema,
});

export const jobDetailSchema = jobSummarySchema.extend({
    recentRuns: z.array(jobRunDetailSchema),
});

export const listJobsOutputSchema = z.object({
    jobs: z.array(jobSummarySchema),
});

export const getJobInputSchema = z.object({
    slug: jobSlugSchema,
});

export const getJobOutputSchema = z.object({
    job: jobDetailSchema,
});

export const runJobInputSchema = z.object({
    payload: z.record(z.string(), z.unknown()).optional(),
    slug: jobSlugSchema,
});

export const runJobOutputSchema = z.object({
    jobId: z.string(),
});

export const jobRunEventSchema = z.object({
    attemptsMade: z.number().int().nonnegative(),
    createdAt: z.string(),
    durationMs: z.number().nullable(),
    error: z.string().nullable(),
    finishedAt: z.string().nullable(),
    id: z.string(),
    jobDisplayName: z.string(),
    jobSlug: jobSlugSchema,
    progress: z.number().int().nonnegative(),
    startedAt: z.string().nullable(),
    state: jobRunStateSchema,
});

export const listRecentRunsOutputSchema = z.object({
    runs: z.array(jobRunEventSchema),
});

export type JobCounts = z.infer<typeof jobCountsSchema>;
export type JobDetail = z.infer<typeof jobDetailSchema>;
export type JobRunDetail = z.infer<typeof jobRunDetailSchema>;
export type JobRunState = z.infer<typeof jobRunStateSchema>;
export type JobRunSummary = z.infer<typeof jobRunSummarySchema>;
export type JobSchedule = z.infer<typeof jobScheduleSchema>;
export type JobSlug = z.infer<typeof jobSlugSchema>;
export type JobRunEvent = z.infer<typeof jobRunEventSchema>;
export type JobSummary = z.infer<typeof jobSummarySchema>;
