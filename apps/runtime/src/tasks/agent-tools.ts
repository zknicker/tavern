import type { ToolSet } from '@ai-sdk/provider-utils';
import {
    type AgentRuntimeTask,
    type AgentRuntimeUpdateTask,
    agentRuntimeTaskScheduledForSchema,
} from '@tavern/api';
import { tool } from 'ai';
import * as z from 'zod';
import { publishTaskUpdated } from './events.ts';
import { createTaskId } from './ids.ts';
import { createTask, getTask, getTaskByNumber, listTasks, updateTask } from './store.ts';

export function createTavernTaskTools(input: { agentId: string }): ToolSet {
    return {
        tasks_list: tool({
            description:
                'List tracked tasks and epics from the shared Tasks board. Each task has a T-number (like T-12) that users reference in chat.',
            inputSchema: listInputSchema,
            execute: (rawInput) => {
                const parsed = listInputSchema.parse(rawInput);
                const tasks = listTasks({
                    epicId: parsed.epicId,
                    kind: parsed.kind,
                    status: parsed.status,
                });
                const filtered = parsed.assignedToMe
                    ? tasks.filter(
                          (task) =>
                              task.assignee?.kind === 'agent' &&
                              task.assignee.agentId === input.agentId
                      )
                    : tasks;
                const numberLookup = createTaskNumberLookup(tasks);
                return Promise.resolve({
                    tasks: filtered.map((task) => toToolTask(task, { numberLookup })),
                });
            },
        }),
        tasks_get: tool({
            description:
                'Read one task from the Tasks board by T-number (like 12 for T-12) or task id, including its full description.',
            inputSchema: getInputSchema,
            execute: (rawInput) => {
                const parsed = getInputSchema.parse(rawInput);
                const task = parsed.taskId
                    ? getTask(parsed.taskId)
                    : getTaskByNumber(parsed.number ?? 0);
                if (!task) {
                    throw new Error('Task not found.');
                }
                return Promise.resolve({
                    task: toToolTask(task, {
                        includeDescription: true,
                        numberLookup: createTaskNumberLookup(listTasks()),
                    }),
                });
            },
        }),
        tasks_create: tool({
            description:
                'File a new task or epic into backlog for user triage. Labels by name, auto-created; blockedBy T-numbers order work; scheduledFor defers it.',
            inputSchema: createInputSchema,
            execute: (rawInput) => {
                const parsed = createInputSchema.parse(rawInput);
                const task = createTask({
                    assignee: parsed.assignToMe
                        ? { agentId: input.agentId, kind: 'agent' }
                        : undefined,
                    blockedBy: resolveBlockedByNumbers(parsed.blockedBy),
                    description: parsed.description,
                    epicId: parsed.epicId,
                    id: createTaskId(),
                    kind: parsed.kind,
                    labels: parsed.labels,
                    priority: parsed.priority,
                    scheduledFor: parsed.scheduledFor,
                    title: parsed.title,
                });
                publishTaskUpdated(task.id);
                return Promise.resolve({
                    task: toToolTask(task, { numberLookup: createTaskNumberLookup(listTasks()) }),
                });
            },
        }),
        tasks_update: tool({
            description:
                'Update task fields. Do not set todo. Labels by name, auto-created; blocked needs a reason; done/review/canceled need a summary.',
            inputSchema: updateInputSchema,
            execute: (rawInput) => {
                const parsed = updateInputSchema.parse(rawInput);
                assertAgentUpdateAllowed(parsed);
                const existing = parsed.taskId
                    ? getTask(parsed.taskId)
                    : getTaskByNumber(parsed.number ?? 0);
                if (!existing) {
                    throw new Error('Task not found.');
                }
                const task = updateTask(existing.id, {
                    ...(parsed.description === undefined
                        ? {}
                        : { description: parsed.description }),
                    ...(parsed.epicId === undefined ? {} : { epicId: parsed.epicId }),
                    ...(parsed.labels === undefined ? {} : { labels: parsed.labels }),
                    ...(parsed.priority === undefined ? {} : { priority: parsed.priority }),
                    ...(parsed.blockedBy === undefined
                        ? {}
                        : { blockedBy: resolveBlockedByNumbers(parsed.blockedBy) }),
                    ...(parsed.scheduledFor === undefined
                        ? {}
                        : { scheduledFor: parsed.scheduledFor }),
                    ...(parsed.status === undefined ? {} : { status: parsed.status }),
                    ...blockedReasonPatch(parsed),
                    ...(parsed.summary === undefined ? {} : { summary: parsed.summary }),
                    ...(parsed.title === undefined ? {} : { title: parsed.title }),
                    ...(parsed.assignToMe
                        ? { assignee: { agentId: input.agentId, kind: 'agent' } }
                        : {}),
                });
                if (!task) {
                    throw new Error('Task not found.');
                }
                publishTaskUpdated(task.id);
                return Promise.resolve({
                    task: toToolTask(task, { numberLookup: createTaskNumberLookup(listTasks()) }),
                });
            },
        }),
    };
}

const statusSchema = z.enum([
    'backlog',
    'todo',
    'in_progress',
    'blocked',
    'review',
    'done',
    'canceled',
]);
const blockedReasonKindSchema = z.enum(['needs_input', 'error']);
const prioritySchema = z.enum(['none', 'urgent', 'high', 'medium', 'low']);
const kindSchema = z.enum(['task', 'epic']);
const tNumberSchema = z.number().int().positive();

const listInputSchema = z
    .object({
        assignedToMe: z.boolean().optional(),
        epicId: z.string().trim().min(1).optional(),
        kind: kindSchema.optional(),
        status: statusSchema.optional(),
    })
    .strict();

const getInputSchema = z
    .object({
        number: z.number().int().positive().optional(),
        taskId: z.string().trim().min(1).optional(),
    })
    .strict()
    .refine((value) => value.number !== undefined || value.taskId !== undefined, {
        message: 'Provide a T-number or task id.',
    });

const createInputSchema = z
    .object({
        assignToMe: z.boolean().optional(),
        blockedBy: z.array(tNumberSchema).optional(),
        description: z.string().trim().min(1).nullable().optional(),
        epicId: z.string().trim().min(1).nullable().optional(),
        kind: kindSchema.optional(),
        labels: z.array(z.string().trim().min(1)).optional(),
        priority: prioritySchema.optional(),
        scheduledFor: agentRuntimeTaskScheduledForSchema.nullable().optional(),
        title: z.string().trim().min(1),
    })
    .strict();

const updateInputSchema = z
    .object({
        assignToMe: z.boolean().optional(),
        blockedBy: z.array(tNumberSchema).optional(),
        blockedReason: z.string().trim().min(1).optional(),
        blockedReasonKind: blockedReasonKindSchema.optional(),
        description: z.string().trim().min(1).nullable().optional(),
        epicId: z.string().trim().min(1).nullable().optional(),
        labels: z.array(z.string().trim().min(1)).optional(),
        number: z.number().int().positive().optional(),
        priority: prioritySchema.optional(),
        scheduledFor: agentRuntimeTaskScheduledForSchema.nullable().optional(),
        status: statusSchema.optional(),
        summary: z.string().trim().min(1).optional(),
        taskId: z.string().trim().min(1).optional(),
        title: z.string().trim().min(1).optional(),
    })
    .strict()
    .refine((value) => value.number !== undefined || value.taskId !== undefined, {
        message: 'Provide a T-number or task id.',
    });

type UpdateInput = z.infer<typeof updateInputSchema>;

function assertAgentUpdateAllowed(input: UpdateInput) {
    if (input.status === 'todo') {
        throw new Error('Only the user promotes tasks into todo.');
    }

    if (input.status === 'blocked' && !(input.blockedReasonKind && input.blockedReason)) {
        throw new Error('Setting blocked requires blockedReasonKind and blockedReason.');
    }

    if (
        (input.status === 'done' || input.status === 'review' || input.status === 'canceled') &&
        !input.summary
    ) {
        throw new Error('Setting done, review, or canceled requires a summary.');
    }
}

function blockedReasonPatch(input: UpdateInput): Partial<AgentRuntimeUpdateTask> {
    if (input.status !== 'blocked') {
        return {};
    }

    if (!(input.blockedReasonKind && input.blockedReason)) {
        throw new Error('Setting blocked requires blockedReasonKind and blockedReason.');
    }

    return {
        blockedReason: {
            kind: input.blockedReasonKind,
            message: input.blockedReason,
        },
    };
}

function resolveBlockedByNumbers(numbers: number[] | undefined): string[] | undefined {
    if (numbers === undefined) {
        return undefined;
    }

    const tasksByNumber = new Map(listTasks().map((task) => [task.number, task.id]));
    return Array.from(new Set(numbers)).map((number) => {
        const taskId = tasksByNumber.get(number);
        if (!taskId) {
            throw new Error(`Unknown blockedBy T-${number}.`);
        }
        return taskId;
    });
}

function createTaskNumberLookup(tasks: AgentRuntimeTask[]) {
    return new Map(tasks.map((task) => [task.id, `T-${task.number}`]));
}

function toToolTask(
    task: AgentRuntimeTask,
    options: { includeDescription?: boolean; numberLookup?: Map<string, string> } = {}
) {
    return {
        assignee: task.assignee,
        blockedBy: task.blockedBy.map((taskId) => options.numberLookup?.get(taskId) ?? taskId),
        blockedReason: task.blockedReason,
        createdAt: task.createdAt,
        ...(options.includeDescription ? { description: task.description } : {}),
        epicId: task.epicId,
        id: task.id,
        kind: task.kind,
        labels: task.labels.map((label) => label.name),
        number: `T-${task.number}`,
        priority: task.priority,
        scheduledFor: task.scheduledFor,
        status: task.status,
        summary: task.summary,
        title: task.title,
        updatedAt: task.updatedAt,
    };
}
