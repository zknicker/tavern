import type { ChatComposerQueuedMessage } from '../../features/chats/chat-composer-queue.ts';
import type { ChatActiveReply } from '../../hooks/chats/chat-timeline-state.ts';
import type { ChatLogOutput } from '../../lib/trpc.tsx';

type ChatRows = NonNullable<ChatLogOutput>['rows'];
type MessageRow = Extract<ChatRows[number], { kind: 'message' }>;
type SenderType = MessageRow['message']['senderType'];
type ToolRow = Extract<ChatRows[number], { kind: 'tool' }>;
interface ChatLayoutPreview {
    activeReply?: ChatActiveReply;
    chat: ReturnType<typeof chatActors>;
    defaultOpenWorkGroups?: boolean;
    rows: ChatRows;
    title: string;
}

const previewTime = '2026-05-08T18:00:00.000Z';
const streamingPreviewStartedAt = new Date(Date.now() - 17_000).toISOString();

export const chatLayoutPreviews: ChatLayoutPreview[] = [
    {
        chat: chatActors({ agents: ['Atlas'], humans: ['You'] }),
        rows: rows([
            user('You', 'Can you summarize the session notes before I reply?'),
            agent(
                'Atlas',
                'Yes. The main decision is to keep the runtime session as the durable source and treat the app handoff state as presentation-only.'
            ),
            user('You', 'Great, pull out the risks too.'),
            agent(
                'Atlas',
                'The biggest risk is creating a second transcript path. I would keep optimistic rows local and let synced history replace them.'
            ),
        ]),
        title: '1 agent, 1 human',
    },
    {
        chat: chatActors({ agents: ['Atlas'], humans: ['You'] }),
        rows: rows([
            userWithFile(
                'You',
                'hi dude, can you please fetch the weather in the 5 biggest us cities',
                'weather-request.txt',
                '/attachments/weather-request.txt'
            ),
            agent(
                'Atlas',
                'Yep — I can use the attached brief and keep the response compact for the preview.'
            ),
        ]),
        title: 'Message + attachment',
    },
    {
        chat: chatActors({ agents: ['Atlas', 'Nova'], humans: ['You'] }),
        rows: rows([
            user('You', 'Can one of you check the runtime boundary and the other scan the UI?'),
            agent(
                'Atlas',
                'I will take the runtime boundary. The send path should use the synced session key, not a derived platform target.'
            ),
            agent(
                'Nova',
                'On the UI side, the active reply state should stay separate from durable history.'
            ),
            user('You', 'That split reads right. Keep it tight.'),
        ]),
        title: '2 agents, 1 human',
    },
    {
        chat: chatActors({ agents: ['Atlas'], humans: ['You', 'Ash'] }),
        rows: rows([
            user('Ash', 'I added the notes from the Discord thread.'),
            user('You', 'Thanks. Atlas, can you turn those into the next implementation pass?'),
            agent(
                'Atlas',
                'Yes. I would make the chat route compose focused reads and keep status in a narrow surface.'
            ),
            user('Ash', 'Please keep the copy short.'),
        ]),
        title: '1 agent, 2 humans',
    },
    {
        chat: chatActors({ agents: ['Atlas', 'Nova'], humans: ['You', 'Ash'] }),
        rows: rows([
            user('Ash', 'The preview needs to show both people and both agents.'),
            agent(
                'Nova',
                'I have the visual pass. Human messages keep grey bubbles, agent messages stay unboxed.'
            ),
            user('You', 'Atlas, check the behavior rules while Nova tunes the layout.'),
            agent(
                'Atlas',
                'The count rule covers all four cases: labels appear only when that actor class has more than one member.'
            ),
        ]),
        title: '2 agents, 2 humans',
    },
    {
        chat: chatActors({ agents: ['Atlas'], humans: ['You'] }),
        rows: rows([
            user('You', 'Make the Hermes activity stream feel like Codex App.'),
            narration(
                'Atlas',
                "I'll first split visible assistant progress updates from tool activity, then I'll keep command and file work grouped between those updates."
            ),
            toolActivity({
                id: 'read-turn-progress',
                label: 'Read turn-progress.js',
                name: 'read',
                summaryParts: ['turn-progress.js'],
            }),
            toolActivity({
                id: 'read-chat-transcript',
                label: 'Read chat-transcript-turn.tsx',
                name: 'read',
                summaryParts: ['chat-transcript-turn.tsx'],
            }),
            toolActivity({
                id: 'run-rg',
                label: 'rg activity grouping',
                name: 'bash',
                summaryParts: ['rg activity grouping apps/website/src/features/chats'],
            }),
            narration(
                'Atlas',
                'The grouping boundary is clear now: preambles should render as assistant prose, while adjacent work rows should stay compact and expandable.'
            ),
            toolActivity({
                id: 'edit-files',
                label: 'Edited 3 files',
                name: 'patch',
                summaryParts: [
                    'chat-transcript-turn.tsx',
                    'working-log.tsx',
                    'chat-layout-preview-page.tsx',
                ],
            }),
            narration(
                'Atlas',
                'The demo now exercises interleaved updates, grouped work, and the final assistant response in one mocked turn.'
            ),
            toolActivity({
                id: 'run-tests',
                label: 'bun test chat transcript',
                name: 'bash',
                summaryParts: ['bun test apps/website/src/features/chats/chat-transcript.test.tsx'],
            }),
            agent(
                'Atlas',
                'Implemented the Codex-style transcript layout. Visible progress updates render as assistant text, and the work rows between them stay grouped by phase.'
            ),
        ]),
        title: 'Hermes activity turn',
    },
    {
        chat: chatActors({ agents: ['Atlas'], humans: ['You'] }),
        rows: rowsAt(
            [
                user(
                    'You',
                    'Check the deployment notes, run whatever tools you need, and stop for approval if the security scan is high.'
                ),
                thinking(
                    'Atlas',
                    '**Planning the pass** I need to inspect the release notes, run a terminal check, then pause on any high-risk scan result.'
                ),
                narration(
                    'Atlas',
                    'I’ll verify the release note wording first, then run the local security scan before changing anything.'
                ),
                toolActivity({
                    id: 'stack-read-release-notes',
                    label: 'Read release notes',
                    name: 'read',
                    summaryParts: ['docs/operations/releases.md'],
                }),
                toolActivity({
                    id: 'stack-run-host-scan',
                    label: 'bun run scan:hosts',
                    name: 'bash',
                    summaryParts: ['bun run scan:hosts'],
                }),
                toolActivity({
                    id: 'stack-approval-security',
                    label: 'Security scan — [HIGH] Invalid characters in hostname: Host names contain spaces',
                    name: 'approval',
                    summaryParts: [
                        'Security scan — [HIGH] Invalid characters in hostname: Host names contain spaces',
                    ],
                }),
                thinking(
                    'Atlas',
                    '**Rechecking after approval** The scan result blocks the risky path, so I should rerun the safe command and summarize the remaining action.'
                ),
                narration(
                    'Atlas',
                    'The high finding is isolated to the hostname list. I’m rerunning the safer validation path now.'
                ),
                toolActivity({
                    id: 'stack-rerun-safe-scan',
                    label: 'bun run scan:hosts -- --strict',
                    name: 'bash',
                    summaryParts: ['bun run scan:hosts -- --strict'],
                }),
                toolActivity({
                    id: 'stack-search-docs',
                    label: 'rg hostname docs',
                    name: 'search_files',
                    summaryParts: ['hostname docs/operations'],
                }),
            ],
            streamingPreviewStartedAt
        ),
        activeReply: {
            agentId: toActorId('Atlas'),
            isThinking: true,
            runId: 'run_preview_streaming_stack',
            sessionKey: `preview:${toActorId('Atlas')}`,
            startedAt: streamingPreviewStartedAt,
            statusSequence: 1,
            text: '',
        },
        defaultOpenWorkGroups: true,
        title: 'Streaming turn stack',
    },
];

export const scrollingToolDrawerPreview = {
    chat: chatActors({ agents: ['Atlas'], humans: ['You'] }),
    rows: buildScrollingToolDrawerRows(),
    title: 'Scrolling virtualized tool drawer',
};

export const chatComposerQueuePreviews: {
    isBlocked: boolean;
    queue: ChatComposerQueuedMessage[];
    title: string;
}[] = [
    {
        isBlocked: false,
        queue: [
            queuedMessage('queued-1', 'Check the release notes wording'),
            queuedMessage('queued-2', 'Then make the changelog tighter', {
                modelRef: 'openai/gpt-5-codex',
            }),
        ],
        title: 'Queued drafts, idle',
    },
    {
        isBlocked: true,
        queue: [
            queuedMessage('queued-3', 'Match these mockups', {
                attachments: [
                    {
                        dataBase64:
                            'iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAYAAACddGYaAAAAEElEQVR42mP8z8AARLJgYAAAL6sCAd5MvA8AAAAASUVORK5CYII=',
                        filename: 'mockup.png',
                        mediaType: 'image/png',
                        sizeBytes: 96_000,
                        type: 'inline',
                    },
                ],
            }),
            queuedMessage('queued-4', 'After that, audit the spacing'),
        ],
        title: 'Queued during active turn',
    },
];

function buildScrollingToolDrawerRows(): ChatRows {
    const fillerRows = Array.from({ length: 12 }, (_, index) => [
        user(
            'You',
            `Checkpoint ${index + 1}: Capture another transcript state before the tool work.`
        ),
        agent(
            'Atlas',
            `Ack ${index + 1}: The transcript row stays stable while the next mocked turn loads.`
        ),
    ]).flat();

    return rows([
        ...fillerRows,
        user('You', 'Open the work group near the tail and keep the header pinned.'),
        narration(
            'Atlas',
            'I will inspect the transcript virtualization path and verify the drawer.'
        ),
        toolActivity({
            id: 'virtual-demo-read-controller',
            label: 'Read use-chat-scroll-controller.ts',
            name: 'read',
            summaryParts: ['use-chat-scroll-controller.ts'],
        }),
        toolActivity({
            id: 'virtual-demo-read-transcript',
            label: 'Read virtualized-chat-transcript.tsx',
            name: 'read',
            summaryParts: ['virtualized-chat-transcript.tsx'],
        }),
        toolActivity({
            id: 'virtual-demo-run-test',
            label: 'bun test chat-scroll-mode',
            name: 'bash',
            summaryParts: ['bun test apps/website/src/features/chats/chat-scroll-mode.test.ts'],
        }),
        toolActivity({
            id: 'virtual-demo-edit',
            label: 'Edited virtualizer resize policy',
            name: 'patch',
            summaryParts: ['virtualized-chat-transcript.tsx', 'use-chat-scroll-controller.ts'],
        }),
        agent(
            'Atlas',
            'The virtualized transcript now keeps the disclosure trigger in place while the drawer expands below it.'
        ),
    ]);
}

function chatActors({ agents, humans }: { agents: string[]; humans: string[] }) {
    return {
        boundAgentIds: agents.map(toActorId),
        participants: [
            ...agents.map((name) => ({ actorId: toActorId(name), actorType: 'agent' as const })),
            ...humans.map((name) => ({
                actorId: toActorId(name),
                actorType: 'participant' as const,
            })),
        ],
    };
}
function rows(messages: ChatRows): ChatRows {
    return messages.map((row, index, allRows) => {
        const previous = allRows[index - 1] ?? null;
        const next = allRows[index + 1] ?? null;
        const actorKey = getActorKey(row);

        return {
            ...row,
            connectsToNext: next ? actorKey === getActorKey(next) : false,
            connectsToPrevious: previous ? actorKey === getActorKey(previous) : false,
            isFirstInGroup: previous ? actorKey !== getActorKey(previous) : true,
        };
    });
}

function rowsAt(messages: ChatRows, timestamp: string): ChatRows {
    return rows(messages).map((row) => withPreviewTimestamp(row, timestamp));
}

function withPreviewTimestamp(row: ChatRows[number], timestamp: string): ChatRows[number] {
    if (row.kind === 'message') {
        return {
            ...row,
            message: {
                ...row.message,
                timestamp,
            },
        };
    }

    if (row.kind === 'tool') {
        return {
            ...row,
            completedAt: row.completedAt ? timestamp : null,
            startedAt: timestamp,
        };
    }

    if (row.kind === 'system' && row.systemKind === 'thinking') {
        return {
            ...row,
            thinking: {
                ...row.thinking,
                timestamp,
            },
            timestamp,
        };
    }

    return row;
}

function agent(sender: string, content: string): MessageRow {
    return message({
        actorKind: 'agent',
        content,
        sender,
        senderType: 'agent',
    });
}

function narration(sender: string, content: string): ToolRow {
    return toolActivity({
        id: `narration:${content.slice(0, 16)}`,
        label: content,
        name: 'message',
        sender,
        summaryParts: [content],
    });
}

function thinking(sender: string, content: string): ChatRows[number] {
    const id = `thinking:${sender}:${content.slice(0, 16)}`;

    return {
        id,
        kind: 'system',
        systemKind: 'thinking',
        thinking: {
            id,
            messageId: `message:${toActorId(sender)}`,
            sender: toActorId(sender),
            text: content,
            timestamp: previewTime,
        },
        timestamp: previewTime,
    };
}

function toolActivity({
    id,
    label,
    name,
    sender = 'Atlas',
    summaryParts,
}: {
    id: string;
    label: string;
    name: string;
    sender?: string;
    summaryParts: string[];
}): ToolRow {
    return {
        actor: {
            id: toActorId(sender),
            kind: 'agent',
        },
        completedAt: previewTime,
        connectsToNext: false,
        connectsToPrevious: false,
        id,
        isFirstInGroup: true,
        kind: 'tool',
        sessionKey: `preview:${toActorId(sender)}`,
        spawnedRelationships: [],
        startedAt: previewTime,
        toolCall: {
            callId: `call_${id.replaceAll(/[^a-z0-9]+/gi, '_')}`,
            facts:
                name === 'bash'
                    ? [{ label: 'Command', tone: 'default', value: summaryParts.join(' ') }]
                    : [],
            label,
            name,
            status: null,
            summaryParts,
        },
    };
}

function user(sender: string, content: string): MessageRow {
    return message({
        actorKind: 'participant',
        content,
        sender,
        senderType: 'user',
    });
}

function queuedMessage(
    id: string,
    content: string,
    options: Partial<Pick<ChatComposerQueuedMessage, 'attachments' | 'modelRef'>> = {}
): ChatComposerQueuedMessage {
    return {
        agentId: 'atlas',
        content,
        createdAt: previewTime,
        id,
        ...(options.attachments ? { attachments: options.attachments } : {}),
        ...(options.modelRef ? { modelRef: options.modelRef } : {}),
    };
}

function userWithFile(sender: string, content: string, filename: string, path: string): MessageRow {
    const row = user(sender, content);

    return {
        ...row,
        message: {
            ...row.message,
            attachments: [
                {
                    filename,
                    mediaType: 'text/plain',
                    path,
                    sizeBytes: 184,
                    type: 'file',
                },
            ],
        },
    };
}

function message({
    actorKind,
    content,
    sender,
    senderType,
}: {
    actorKind: 'agent' | 'participant';
    content: string;
    sender: string;
    senderType: SenderType;
}): MessageRow {
    const id = `${sender}:${content.slice(0, 16)}`;

    return {
        actor: {
            id: toActorId(sender),
            kind: actorKind,
        },
        connectsToNext: false,
        connectsToPrevious: false,
        id,
        isFirstInGroup: true,
        kind: 'message',
        message: {
            tavernAgentId: senderType === 'agent' ? toActorId(sender) : null,
            content,
            id,
            sender,
            senderType,
            sourceSessionId: `session:${toActorId(sender)}`,
            sourceSessionKey: `preview:${toActorId(sender)}`,
            timestamp: previewTime,
        },
    };
}

function getActorKey(row: ChatRows[number]) {
    return 'actor' in row && row.actor ? `${row.actor.kind}:${row.actor.id}` : null;
}

function toActorId(name: string) {
    return name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-');
}
