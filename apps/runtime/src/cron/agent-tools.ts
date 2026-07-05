import type { ToolSet } from '@ai-sdk/provider-utils';
import type { AgentRuntimeCreateCron, AgentRuntimeCronSummary } from '@tavern/api';
import { tool } from 'ai';
import * as z from 'zod';
import { publishCronDeleted, publishCronUpdated } from './events.ts';
import { createCronJobId } from './ids.ts';
import { isRuntimeCronReady, reconcileActiveCronSchedules } from './manager-state.ts';
import { createValidatedCronJob, updateValidatedCronJob } from './service.ts';
import { deleteCronJob, getCronJob, listCronJobs } from './store.ts';

export function createTavernCronTools(input: { agentId: string }): ToolSet {
    return {
        cron_list: tool({
            description:
                'List your own scheduled automations, including schedule, enabled state, next run, and last run status.',
            inputSchema: listInputSchema,
            execute: async (rawInput) => {
                listInputSchema.parse(rawInput);
                assertCronAvailable();
                return {
                    jobs: listCronJobs()
                        .filter((job) => job.agentId === input.agentId)
                        .map(toToolSummary),
                };
            },
        }),
        cron_create: tool({
            description:
                'Create a scheduled automation that sends your message into a chat you participate in. Confirm the schedule and chat with the user before creating one.',
            inputSchema: createInputSchema,
            execute: async (rawInput) => {
                const parsed = createInputSchema.parse(rawInput);
                assertCronAvailable();
                const job = createValidatedCronJob({
                    agentId: input.agentId,
                    deleteAfterRun: parsed.deleteAfterRun,
                    delivery: { chatId: parsed.chatId },
                    description: parsed.description,
                    enabled: parsed.enabled,
                    id: createCronJobId(),
                    name: parsed.name,
                    payload: { kind: 'agentTurn', message: parsed.message },
                    schedule: parsed.schedule,
                });
                await reconcileActiveCronSchedules();
                publishCronUpdated(job.id);
                return { job: toToolSummary(getCronJob(job.id) ?? job) };
            },
        }),
        cron_update: tool({
            description:
                'Update one of your scheduled automations. Only include fields that should change.',
            inputSchema: updateInputSchema,
            execute: async (rawInput) => {
                const parsed = updateInputSchema.parse(rawInput);
                assertCronAvailable();
                const existing = getOwnCronJobOrThrow(parsed.jobId, input.agentId);
                const job = updateValidatedCronJob(parsed.jobId, {
                    ...(parsed.chatId ? { delivery: { chatId: parsed.chatId } } : {}),
                    ...(parsed.deleteAfterRun === undefined
                        ? {}
                        : { deleteAfterRun: parsed.deleteAfterRun }),
                    ...(parsed.description === undefined
                        ? {}
                        : { description: parsed.description }),
                    ...(parsed.enabled === undefined ? {} : { enabled: parsed.enabled }),
                    ...(parsed.message
                        ? { payload: { kind: 'agentTurn', message: parsed.message } }
                        : {}),
                    ...(parsed.name ? { name: parsed.name } : {}),
                    ...(parsed.schedule ? { schedule: parsed.schedule } : {}),
                    agentId: existing.agentId,
                });
                if (!job) {
                    throw new Error('Cron job not found.');
                }
                await reconcileActiveCronSchedules();
                publishCronUpdated(job.id);
                return { job: toToolSummary(getCronJob(job.id) ?? job) };
            },
        }),
        cron_delete: tool({
            description: 'Delete one of your scheduled automations.',
            inputSchema: deleteInputSchema,
            execute: async (rawInput) => {
                const parsed = deleteInputSchema.parse(rawInput);
                assertCronAvailable();
                getOwnCronJobOrThrow(parsed.jobId, input.agentId);
                const deleted = deleteCronJob(parsed.jobId);
                if (!deleted) {
                    throw new Error('Cron job not found.');
                }
                await reconcileActiveCronSchedules();
                publishCronDeleted(parsed.jobId);
                return { deleted: true, id: parsed.jobId };
            },
        }),
    };
}

const scheduleSchema = z.union([
    z.object({ at: z.string().trim().min(1), kind: z.literal('at') }).strict(),
    z.object({ everyMs: z.number().int().positive(), kind: z.literal('every') }).strict(),
    z
        .object({
            expr: z.string().trim().min(1),
            kind: z.literal('cron'),
            tz: z.string().trim().min(1).optional(),
        })
        .strict(),
]);

const listInputSchema = z.object({}).strict();

const createInputSchema = z
    .object({
        chatId: z.string().trim().min(1),
        deleteAfterRun: z.boolean().optional(),
        description: z.string().trim().min(1).nullable().optional(),
        enabled: z.boolean().optional(),
        message: z.string().trim().min(1),
        name: z.string().trim().min(1),
        schedule: scheduleSchema,
    })
    .strict();

const updateInputSchema = createInputSchema
    .partial()
    .extend({
        jobId: z.string().trim().min(1),
    })
    .strict();

const deleteInputSchema = z
    .object({
        jobId: z.string().trim().min(1),
    })
    .strict();

function assertCronAvailable() {
    if (!isRuntimeCronReady()) {
        throw new Error('Cron is not available.');
    }
}

function getOwnCronJobOrThrow(jobId: string, agentId: string) {
    const job = getCronJob(jobId);
    if (!job || job.agentId !== agentId) {
        throw new Error('Cron job not found for this agent.');
    }
    return job;
}

function toToolSummary(job: AgentRuntimeCronSummary | AgentRuntimeCreateCron) {
    const state = 'state' in job ? job.state : {};
    return {
        enabled: job.enabled ?? true,
        id: job.id,
        lastRunStatus: state.lastRunStatus,
        name: job.name,
        nextRunAtMs: state.nextRunAtMs,
        schedule: job.schedule,
    };
}
