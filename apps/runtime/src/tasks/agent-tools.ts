import type { ToolSet } from '@ai-sdk/provider-utils';
import type { AgentRuntimeTask } from '@tavern/api';
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
                return Promise.resolve({ tasks: filtered.map((task) => toToolTask(task)) });
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
                return Promise.resolve({ task: toToolTask(task, { includeDescription: true }) });
            },
        }),
        tasks_create: tool({
            description:
                'File a new task (or epic) on the shared Tasks board. Use when the user asks to track work, or when you notice follow-up work worth tracking. Returns the new T-number.',
            inputSchema: createInputSchema,
            execute: (rawInput) => {
                const parsed = createInputSchema.parse(rawInput);
                const task = createTask({
                    assignee: parsed.assignToMe
                        ? { agentId: input.agentId, kind: 'agent' }
                        : undefined,
                    description: parsed.description,
                    epicId: parsed.epicId,
                    id: createTaskId(),
                    kind: parsed.kind,
                    labels: parsed.labels,
                    priority: parsed.priority,
                    status: parsed.status,
                    title: parsed.title,
                });
                publishTaskUpdated(task.id);
                return Promise.resolve({ task: toToolTask(task) });
            },
        }),
        tasks_update: tool({
            description:
                'Update a task on the Tasks board: status (backlog/todo/in_progress/done/canceled), priority, title, description, labels, or epic. Mark tasks in_progress when you start them and done when you finish. Only include fields that should change.',
            inputSchema: updateInputSchema,
            execute: (rawInput) => {
                const parsed = updateInputSchema.parse(rawInput);
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
                    ...(parsed.status === undefined ? {} : { status: parsed.status }),
                    ...(parsed.title === undefined ? {} : { title: parsed.title }),
                    ...(parsed.assignToMe
                        ? { assignee: { agentId: input.agentId, kind: 'agent' } }
                        : {}),
                });
                if (!task) {
                    throw new Error('Task not found.');
                }
                publishTaskUpdated(task.id);
                return Promise.resolve({ task: toToolTask(task) });
            },
        }),
    };
}

const statusSchema = z.enum(['backlog', 'todo', 'in_progress', 'done', 'canceled']);
const prioritySchema = z.enum(['none', 'urgent', 'high', 'medium', 'low']);
const kindSchema = z.enum(['task', 'epic']);

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
        description: z.string().trim().min(1).nullable().optional(),
        epicId: z.string().trim().min(1).nullable().optional(),
        kind: kindSchema.optional(),
        labels: z.array(z.string().trim().min(1)).optional(),
        priority: prioritySchema.optional(),
        status: statusSchema.optional(),
        title: z.string().trim().min(1),
    })
    .strict();

const updateInputSchema = z
    .object({
        assignToMe: z.boolean().optional(),
        description: z.string().trim().min(1).nullable().optional(),
        epicId: z.string().trim().min(1).nullable().optional(),
        labels: z.array(z.string().trim().min(1)).optional(),
        number: z.number().int().positive().optional(),
        priority: prioritySchema.optional(),
        status: statusSchema.optional(),
        taskId: z.string().trim().min(1).optional(),
        title: z.string().trim().min(1).optional(),
    })
    .strict()
    .refine((value) => value.number !== undefined || value.taskId !== undefined, {
        message: 'Provide a T-number or task id.',
    });

function toToolTask(task: AgentRuntimeTask, options: { includeDescription?: boolean } = {}) {
    return {
        assignee: task.assignee,
        createdAt: task.createdAt,
        ...(options.includeDescription ? { description: task.description } : {}),
        epicId: task.epicId,
        id: task.id,
        kind: task.kind,
        labels: task.labels,
        number: `T-${task.number}`,
        priority: task.priority,
        status: task.status,
        title: task.title,
        updatedAt: task.updatedAt,
    };
}
