import type { ToolSet } from '@ai-sdk/provider-utils';
import type { AgentRuntimeTask, AgentRuntimeUpdateTask } from '@tavern/api';
import { tool } from 'ai';
import { getStoredAgent } from '../tavern/agents-store.ts';
import {
    createInputSchema,
    getInputSchema,
    listInputSchema,
    type TaskToolUpdateInput,
    updateInputSchema,
} from './agent-tool-inputs.ts';
import { promoteTaskAttachments } from './attachments.ts';
import { publishTaskUpdated } from './events.ts';
import { createTaskId } from './ids.ts';
import { createTask, getTask, getTaskByNumber, listTasks, updateTask } from './store.ts';

export function createTavernTaskTools(input: { agentId: string; chatId?: string }): ToolSet {
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
                const task = createTask(
                    {
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
                    },
                    { originChatId: input.chatId }
                );
                publishTaskUpdated(task.id);
                return Promise.resolve({
                    note: 'Filed to backlog for user triage. Do not start this work now: it runs when the task is dispatched to you or the user says to begin.',
                    task: toToolTask(task, { numberLookup: createTaskNumberLookup(listTasks()) }),
                });
            },
        }),
        tasks_update: tool({
            description:
                'Update task fields and attach deliverables by workspace path. Do not set todo. Labels by name, auto-created; blocked needs a reason; done/review/canceled need a summary.',
            inputSchema: updateInputSchema,
            execute: async (rawInput) => {
                const parsed = updateInputSchema.parse(rawInput);
                assertAgentUpdateAllowed(parsed);
                const existing = parsed.taskId
                    ? getTask(parsed.taskId)
                    : getTaskByNumber(parsed.number ?? 0);
                if (!existing) {
                    throw new Error('Task not found.');
                }
                assertAttachmentUpdateAllowed(parsed, existing.status);
                const reviewPolicyApplied =
                    parsed.status === 'done' &&
                    getStoredAgent(input.agentId)?.taskReviewPolicy === true;
                if (parsed.attachments && parsed.attachments.length > 0) {
                    await promoteTaskAttachments({
                        agentId: input.agentId,
                        paths: parsed.attachments,
                        taskId: existing.id,
                    });
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
                    ...(parsed.status === undefined
                        ? {}
                        : { status: reviewPolicyApplied ? 'review' : parsed.status }),
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
                return {
                    ...(reviewPolicyApplied
                        ? { note: 'Review policy routed this completion to review.' }
                        : {}),
                    task: toToolTask(task, { numberLookup: createTaskNumberLookup(listTasks()) }),
                };
            },
        }),
    };
}

function assertAgentUpdateAllowed(input: TaskToolUpdateInput) {
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

function assertAttachmentUpdateAllowed(
    input: TaskToolUpdateInput,
    currentStatus: AgentRuntimeTask['status']
) {
    if (!input.attachments || input.attachments.length === 0) {
        return;
    }
    const closesTask =
        input.status !== currentStatus &&
        (input.status === 'done' || input.status === 'review' || input.status === 'canceled');
    const worksInProgress = currentStatus === 'in_progress' || input.status === 'in_progress';
    if (!(closesTask || worksInProgress)) {
        throw new Error(
            'Attachments require closing the task as done, review, or canceled, or working in_progress.'
        );
    }
}

function blockedReasonPatch(input: TaskToolUpdateInput): Partial<AgentRuntimeUpdateTask> {
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
        attachments: task.attachments.map((attachment) => attachment.filename),
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
