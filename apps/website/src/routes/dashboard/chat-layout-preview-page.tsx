import { getChatMessageLayout } from '../../features/chats/chat-message-layout.ts';
import { ChatTimeline } from '../../features/chats/chat-timeline.tsx';
import type { ChatLogOutput } from '../../lib/trpc.tsx';

type ChatRows = NonNullable<ChatLogOutput>['rows'];
type MessageRow = Extract<ChatRows[number], { kind: 'message' }>;
type SenderType = MessageRow['message']['senderType'];
type ToolRow = Extract<ChatRows[number], { kind: 'tool' }>;

const previewTime = '2026-05-08T18:00:00.000Z';

const previews = [
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
            user('You', 'Make the OpenClaw activity stream feel like Codex App.'),
            narration(
                'Atlas',
                'I’ll first split visible assistant progress updates from tool activity, then I’ll keep command and file work grouped between those updates.'
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
                summaryParts: ['chat-transcript-turn.tsx', 'working-log.tsx', 'chat-layout-preview-page.tsx'],
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
        title: 'OpenClaw activity turn',
    },
];

export function ChatLayoutPreviewPage() {
    return (
        <div className="h-full min-h-0 overflow-y-auto px-6 py-5">
            <div className="mx-auto flex w-full max-w-[74rem] flex-col gap-5">
                <div className="px-1">
                    <h1 className="font-medium text-foreground text-lg">Chat Layout Preview</h1>
                    <p className="mt-1 text-muted-foreground text-sm">
                        Mocked conversations for the four participant mixes.
                    </p>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                    {previews.map((preview) => (
                        <section
                            className="min-h-[24rem] rounded-lg border border-border bg-background"
                            key={preview.title}
                        >
                            <div className="border-border border-b px-4 py-3">
                                <h2 className="font-medium text-foreground text-sm">
                                    {preview.title}
                                </h2>
                            </div>
                            <div className="px-2 py-3">
                                <ChatTimeline
                                    activeReply={null}
                                    conversationLayout={getChatMessageLayout(preview.chat)}
                                    rows={preview.rows}
                                    totalRows={preview.rows.length}
                                />
                            </div>
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
}

function chatActors({ agents, humans }: { agents: string[]; humans: string[] }) {
    return {
        boundAgentIds: agents.map(toActorId),
        participants: [
            ...agents.map((name) => ({
                actorId: toActorId(name),
                actorType: 'agent' as const,
            })),
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
                    ? [
                          {
                              label: 'Command',
                              tone: 'default',
                              value: summaryParts.join(' '),
                          },
                      ]
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
