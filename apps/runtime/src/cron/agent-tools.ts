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
                'Create a scheduled automation that delivers into a chat you participate in. Agent mode (message) sends your message and starts your turn. Script mode (script) runs a shell command in your workspace at zero model cost: non-empty stdout is delivered as the message and wakes you; empty stdout or a `{"wakeAgent": false}` line records a quiet tick and posts nothing. Prefer script mode for watchdogs. Confirm the schedule and chat with the user before creating one.',
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
                    payload: toCronPayload(parsed),
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
                    ...(parsed.message || parsed.script ? { payload: toCronPayload(parsed) } : {}),
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

const modeFieldsSchema = z.object({
    message: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe('Agent mode: the message delivered to you on each run.'),
    script: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe(
            'Script mode: shell command run on each tick. Print the alert to stdout only when something needs attention; print nothing (or `{"wakeAgent": false}`) for a quiet tick.'
        ),
    scriptWorkingDir: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe('Script working directory; relative paths resolve under your workspace.'),
});

const createInputSchema = z
    .object({
        chatId: z.string().trim().min(1),
        deleteAfterRun: z.boolean().optional(),
        description: z.string().trim().min(1).nullable().optional(),
        enabled: z.boolean().optional(),
        name: z.string().trim().min(1),
        schedule: scheduleSchema,
        ...modeFieldsSchema.shape,
    })
    .strict()
    .superRefine(requireExactlyOneMode);

const updateInputSchema = z
    .object({
        chatId: z.string().trim().min(1).optional(),
        deleteAfterRun: z.boolean().optional(),
        description: z.string().trim().min(1).nullable().optional(),
        enabled: z.boolean().optional(),
        jobId: z.string().trim().min(1),
        name: z.string().trim().min(1).optional(),
        schedule: scheduleSchema.optional(),
        ...modeFieldsSchema.shape,
    })
    .strict()
    .superRefine((value, ctx) => {
        if (value.message && value.script) {
            ctx.addIssue({
                code: 'custom',
                message: 'Provide either message (agent mode) or script (script mode), not both.',
            });
        }
    });

function requireExactlyOneMode(value: { message?: string; script?: string }, ctx: z.RefinementCtx) {
    if (Boolean(value.message) === Boolean(value.script)) {
        ctx.addIssue({
            code: 'custom',
            message: 'Provide exactly one of message (agent mode) or script (script mode).',
        });
    }
}

function toCronPayload(input: { message?: string; script?: string; scriptWorkingDir?: string }) {
    if (input.script) {
        return {
            command: input.script,
            kind: 'script' as const,
            workingDir: input.scriptWorkingDir,
        };
    }
    if (!input.message) {
        throw new Error('Cron payload needs a message or script.');
    }
    return { kind: 'agentTurn' as const, message: input.message };
}

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
        mode: 'mode' in job ? job.mode : job.payload.kind,
        name: job.name,
        nextRunAtMs: state.nextRunAtMs,
        schedule: job.schedule,
    };
}
