import * as z from 'zod';
import { type AgentApiRequester, createAgentApiClient } from '../agent-api-client.ts';
import { agentMessageSchema } from '../agent-api-schemas.ts';
import { AgentCliError } from '../agent-error.ts';
import { shortMessageId } from '../agent-format.ts';
import type { ParsedArgs } from '../parse.ts';
import type { SubCommand } from '../subcommand.ts';

// Family 5 — Tasks (D8). A task is a message with task metadata; claiming is
// the concurrency lock. `task create` posts a fresh message and publishes it
// as a task in one step.

interface TaskDeps {
    client: AgentApiRequester;
    readStdin(): Promise<string>;
    stdinIsTty(): boolean;
    write(text: string): void;
}

const taskRowSchema = z.object({
    assignee: z.string().nullable(),
    message: agentMessageSchema,
    number: z.number().int().positive(),
    status: z.enum(['todo', 'in_progress', 'in_review', 'done', 'closed']),
    target: z.string().nullable(),
});

const taskListResponseSchema = z.object({ tasks: z.array(taskRowSchema) });
const taskCreateResponseSchema = z.object({ tasks: z.array(taskRowSchema) });
const taskClaimResponseSchema = z.object({ claimed: z.array(taskRowSchema) });
const taskSingleResponseSchema = z.object({ task: taskRowSchema });

const statusFlag = {
    description: 'Task status filter or new status',
    name: '--status',
    valueName: '<status>',
};
const targetFlag = {
    description: "Channel or DM target, e.g. '#general' or 'dm:@zach'",
    name: '--target',
    valueName: '<target>',
};
const numberFlag = {
    description: 'Task number (repeatable on claim)',
    name: '--number',
    valueName: '<n>',
};

export const TASK_SUBCOMMANDS: SubCommand[] = [
    {
        examples: ['grotto task list', 'grotto task list --target "#general" --status in_progress'],
        flags: [targetFlag, statusFlag],
        name: 'list',
        positionals: [],
        run: (args) => runTaskList(args, defaultDeps()),
        summary: 'List task-messages across your chats or one target',
        usage: 'grotto task list [--target <target>] [--status all|todo|in_progress|in_review|done|closed]',
    },
    {
        examples: [
            'grotto task create --target "#general" <<\'GROTTOMSG\'\nInvestigate the failing nightly export.\nGROTTOMSG',
            'grotto task create --target "#general" --title "Phase 1: audit" --title "Phase 2: fix"',
        ],
        flags: [
            targetFlag,
            {
                description: 'Task body per task (repeatable); otherwise the body is stdin',
                name: '--title',
                valueName: '<text>',
            },
            {
                description: 'Only your own handle: creates the task claimed (in_progress)',
                name: '--assignee',
                valueName: '<@handle>',
            },
        ],
        name: 'create',
        positionals: [],
        run: (args) => runTaskCreate(args, defaultDeps()),
        summary: 'Post a new message and publish it as a task',
        usage: 'grotto task create --target <target> [--title <text>]... [--assignee @you]',
    },
    {
        examples: [
            'grotto task claim --target "#general" --number 1 --number 2',
            'grotto task claim --target "#general" --message-id 1a2b3c4d',
        ],
        flags: [
            targetFlag,
            numberFlag,
            {
                description: 'Claim a regular message: converts it to a task you own',
                name: '--message-id',
                valueName: '<id>',
            },
        ],
        name: 'claim',
        positionals: [],
        run: (args) => runTaskClaim(args, defaultDeps()),
        summary: 'Claim tasks before working — the claim is the concurrency lock',
        usage: 'grotto task claim --target <target> (--number <n>... | --message-id <id>)',
    },
    {
        examples: ['grotto task unclaim --target "#general" --number 1'],
        flags: [targetFlag, numberFlag],
        name: 'unclaim',
        positionals: [],
        run: (args) => runTaskUnclaim(args, defaultDeps()),
        summary: 'Release a task you claimed',
        usage: 'grotto task unclaim --target <target> --number <n>',
    },
    {
        examples: ['grotto task update --target "#general" --number 1 --status in_review'],
        flags: [targetFlag, numberFlag, statusFlag],
        name: 'update',
        positionals: [],
        run: (args) => runTaskUpdate(args, defaultDeps()),
        summary: 'Move a task through todo → in_progress → in_review → done (closed is reversible)',
        usage: 'grotto task update --target <target> --number <n> --status <status>',
    },
];

export async function runTaskList(args: ParsedArgs, deps: TaskDeps): Promise<number> {
    const params = new URLSearchParams();
    const target = args.values['--target'];
    const status = args.values['--status'];
    if (target) {
        params.set('target', target);
    }
    if (status) {
        params.set('status', status);
    }
    const query = params.size > 0 ? `?${params.toString()}` : '';
    const response = await deps.client.request(`/api/agent/tasks${query}`, taskListResponseSchema, {
        method: 'GET',
    });
    if (response.tasks.length === 0) {
        deps.write(
            'No tasks found. A task is a message with task metadata — claim work with grotto task claim, or create new work with grotto task create.\n'
        );
        return 0;
    }
    const lines = response.tasks.map((task) => taskLine(task));
    deps.write(
        `${lines.join('\n')}\n\nClaim before you work: grotto task claim --target <target> --number <n>\n`
    );
    return 0;
}

export async function runTaskCreate(args: ParsedArgs, deps: TaskDeps): Promise<number> {
    const target = requireTarget(args, 'grotto task create --target "#channel"');
    const titles = args.valueLists?.['--title'] ?? [];
    let content: string | undefined;
    if (titles.length === 0) {
        if (deps.stdinIsTty()) {
            throw new AgentCliError(
                'MISSING_CONTENT',
                'Task create needs --title flags or a heredoc body on stdin.',
                {
                    nextAction:
                        'grotto task create --target "#channel" <<\'GROTTOMSG\'\n<task body>\nGROTTOMSG',
                }
            );
        }
        content = (await deps.readStdin()).trim();
        if (!content) {
            throw new AgentCliError('MISSING_CONTENT', 'Task body from stdin was empty.');
        }
    }
    const response = await deps.client.request(
        '/api/agent/tasks/create',
        taskCreateResponseSchema,
        {
            body: {
                assignee: args.values['--assignee'],
                content,
                target,
                titles: titles.length > 0 ? titles : undefined,
            },
            method: 'POST',
        }
    );
    const lines = response.tasks.map(
        (task) =>
            `Created task #${task.number} [${task.status}] in ${task.target ?? target}. Message ID: ${task.message.id}`
    );
    deps.write(
        `${lines.join('\n')}\nProgress updates belong in the task's thread: use target "${target}:${shortMessageId(response.tasks[0]?.message.id ?? '')}".\n`
    );
    return 0;
}

export async function runTaskClaim(args: ParsedArgs, deps: TaskDeps): Promise<number> {
    const target = requireTarget(args, 'grotto task claim --target "#channel" --number 1');
    const numbers = (args.valueLists?.['--number'] ?? []).map((value) => parseTaskNumber(value));
    const messageId = args.values['--message-id'];
    if (numbers.length === 0 && !messageId) {
        throw new AgentCliError('INVALID_ARG', 'Pass --number (repeatable) or --message-id.', {
            nextAction: 'grotto task claim --target <target> --number <n>',
        });
    }
    const response = await deps.client.request('/api/agent/tasks/claim', taskClaimResponseSchema, {
        body: {
            messageId,
            numbers: numbers.length > 0 ? numbers : undefined,
            target,
        },
        method: 'POST',
    });
    const lines = response.claimed.map(
        (task) =>
            `Claimed task #${task.number} [${task.status}]. Work it in thread target "${task.target ?? target}:${shortMessageId(task.message.id)}".`
    );
    deps.write(
        `${lines.join('\n')}\nWhen ready for validation: grotto task update --status in_review.\n`
    );
    return 0;
}

export async function runTaskUnclaim(args: ParsedArgs, deps: TaskDeps): Promise<number> {
    const target = requireTarget(args, 'grotto task unclaim --target "#channel" --number 1');
    const response = await deps.client.request(
        '/api/agent/tasks/unclaim',
        taskSingleResponseSchema,
        {
            body: { number: singleNumber(args), target },
            method: 'POST',
        }
    );
    deps.write(
        `Released task #${response.task.number} [${response.task.status}]. It is unassigned and claimable again.\n`
    );
    return 0;
}

export async function runTaskUpdate(args: ParsedArgs, deps: TaskDeps): Promise<number> {
    const target = requireTarget(
        args,
        'grotto task update --target "#channel" --number 1 --status in_review'
    );
    const status = args.values['--status'];
    if (!status) {
        throw new AgentCliError(
            'INVALID_ARG',
            'Provide --status todo|in_progress|in_review|done|closed.'
        );
    }
    const response = await deps.client.request(
        '/api/agent/tasks/update',
        taskSingleResponseSchema,
        {
            body: { number: singleNumber(args), status, target },
            method: 'POST',
        }
    );
    const task = response.task;
    deps.write(
        `Task #${task.number} is now [${task.status}]${task.assignee ? ` (assignee @${task.assignee})` : ''}.\n`
    );
    return 0;
}

function taskLine(task: z.infer<typeof taskRowSchema>): string {
    const assignee = task.assignee ? ` @${task.assignee}` : ' unassigned';
    const where = task.target ? ` in ${task.target}` : '';
    const title = task.message.content.replaceAll(/\s+/gu, ' ').trim();
    const clipped = title.length > 80 ? `${title.slice(0, 79)}…` : title;
    return `#${task.number} [${task.status}]${assignee}${where} msg=${shortMessageId(task.message.id)}: ${clipped}`;
}

function requireTarget(args: ParsedArgs, nextAction: string): string {
    const target = args.values['--target'];
    if (!target) {
        throw new AgentCliError('INVALID_ARG', 'Provide --target with a channel or DM target.', {
            nextAction,
        });
    }
    return target;
}

function singleNumber(args: ParsedArgs): number {
    const numbers = args.valueLists?.['--number'] ?? [];
    if (numbers.length !== 1) {
        throw new AgentCliError('INVALID_ARG', 'Provide exactly one --number.');
    }
    return parseTaskNumber(numbers[0] ?? '');
}

function parseTaskNumber(value: string): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
        throw new AgentCliError('INVALID_ARG', `Invalid task number "${value}".`);
    }
    return parsed;
}

function defaultDeps(): TaskDeps {
    return {
        client: createAgentApiClient(),
        readStdin: async () => {
            let data = '';
            for await (const chunk of process.stdin) {
                data += chunk;
            }
            return data;
        },
        stdinIsTty: () => process.stdin.isTTY === true,
        write: (text) => process.stdout.write(text),
    };
}
