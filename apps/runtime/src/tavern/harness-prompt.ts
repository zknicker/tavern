import type { TavernChatMessage } from '@tavern/api';
import { formatLocalTimestampWithWeekday } from '../timezone.ts';
import { resolveHomeTimezone } from '../timezone-settings.ts';
import type { AgentExecutorInput } from './agent-executor.ts';
import { getStoredAgent } from './agents-store.ts';
import {
    getChat,
    getMessage,
    latestMessageSequence,
    listChatsForAgentParticipant,
    listRecentMessagesBetween,
} from './chat-api/index.ts';
import { projectTavernMessageForAgent } from './mention-projection.ts';
import { readSeenCursor } from './seen-ledger.ts';
import { type AgentTurnOutcomeNote, consumeAgentTurnOutcomeNotes } from './turn-outcome-notes.ts';

const maxAmbientContextMessages = 20;
const maxPendingChatLines = 8;

export function harnessPrompt(input: AgentExecutorInput, recallContext?: null | string) {
    const timezone = resolveHomeTimezone();
    const context = buildHarnessPromptContext(input);
    const sections = [
        'This turn:',
        `- current time: ${promptTimestamp(new Date().toISOString(), timezone)}`,
        context.currentMessage
            ? `- triggering message: ${input.requestMessageId} (seq ${context.currentMessage.sequence})`
            : `- triggering message: ${input.requestMessageId}`,
        // The session spans every chat; each turn re-anchors it to the chat
        // it is speaking in (specs/sessions.md).
        ...chatIdentityLines(input, timezone),
    ];

    // First turn of a rotated session: no engine session exists yet, so prior
    // conversation is genuinely absent — say so instead of letting the model
    // guess.
    if (!input.agentSession.runtimeSessionId && input.agentSession.generation > 1) {
        sections.push(
            '- This session just started fresh; earlier conversation is not in context. Use the chat tools or Memory if you need it.'
        );
    }

    if (recallContext) {
        sections.push('', recallContext);
    }

    // Outcomes of evaluation turns this seat's messages dispatched, once and
    // marked consumed so orchestrators never poll transcripts.
    const outcomeNotes = consumeAgentTurnOutcomeNotes({
        agentId: input.agent.id,
        chatId: input.chatId,
        runId: input.runId,
    });
    if (outcomeNotes.length > 0) {
        sections.push(
            '',
            'Outcomes of turns your messages dispatched:',
            ...outcomeNotes.map((note) => formatOutcomeNote(note, input.chatId, timezone))
        );
    }

    if (context.ambientMessages.length > 0) {
        sections.push(
            '',
            'Messages in this chat since your last turn:',
            ...context.ambientMessages.map((message) => formatPromptMessage(message, timezone))
        );
        if (context.ambientMessagesOmitted) {
            sections.push(
                `(${context.ambientMessages.length} most recent shown; use chat_messages_list or chat_messages_search for earlier.)`
            );
        }
    }

    if (context.replyContext) {
        sections.push('', 'Reply context:', formatPromptMessage(context.replyContext, timezone));
    }

    // Pending traffic elsewhere: unread counts per other chat, never bodies.
    // The agent reads with the chat tools; auto-drain brings dedicated turns.
    const pendingLines = pendingChatLines(input);
    if (pendingLines.length > 0) {
        sections.push('', 'Unread elsewhere (read with chat tools if relevant):', ...pendingLines);
    }

    sections.push(
        '',
        `New message for ${input.agent.name}:`,
        formatPromptMessageContent(input, timezone)
    );

    return sections.join('\n');
}

export function promptCursorSequence(input: AgentExecutorInput) {
    const request = getMessage(input.requestMessageId);
    return request?.sequence ?? readSeenCursor(input.agentSession.id, input.chatId);
}

function buildHarnessPromptContext(input: AgentExecutorInput) {
    const request = getMessage(input.requestMessageId);
    // Catch-up applies to every chat kind (specs/sessions.md seen ledger):
    // the prompt carries the trigger chat's unseen rows since the cursor.
    // DMs usually have none — each message triggers its own turn — but a
    // failed or stopped turn must not lose its row.
    const ambientCandidates = request
        ? listRecentMessagesBetween(input.chatId, {
              afterSequence: readSeenCursor(input.agentSession.id, input.chatId),
              beforeSequence: request.sequence,
              limit: maxAmbientContextMessages + 1,
          })
        : [];
    const filteredAmbientMessages = ambientCandidates.filter((message) =>
        isAmbientPromptMessage(input, message)
    );
    const ambientMessages = filteredAmbientMessages.slice(-maxAmbientContextMessages);
    const replyContext = request?.parent_message_id
        ? getReplyContext({
              ambientMessages,
              currentMessageId: request.id,
              parentMessageId: request.parent_message_id,
          })
        : null;

    return {
        ambientMessages,
        ambientMessagesOmitted: filteredAmbientMessages.length > maxAmbientContextMessages,
        currentMessage: request,
        replyContext,
    };
}

function getReplyContext(input: {
    ambientMessages: TavernChatMessage[];
    currentMessageId: string;
    parentMessageId: string;
}) {
    if (
        input.parentMessageId === input.currentMessageId ||
        input.ambientMessages.some((message) => message.id === input.parentMessageId)
    ) {
        return null;
    }
    const message = getMessage(input.parentMessageId);
    if (
        message &&
        !message.deleted_at &&
        (message.role === 'assistant' || message.role === 'user')
    ) {
        return message;
    }
    return null;
}

function isAmbientPromptMessage(input: AgentExecutorInput, message: TavernChatMessage) {
    if (message.deleted_at) {
        return false;
    }
    if (message.role !== 'assistant' && message.role !== 'user') {
        return false;
    }
    return message.author.id !== input.agentParticipantId;
}

// Where the agent is speaking: chat kind, id, description, and roster with
// mention links so the handoff syntax is always in view. Moved here from the
// system prompt because one global session spans chats with different rosters.
function chatIdentityLines(input: AgentExecutorInput, _timezone: string) {
    const chat = getChat(input.chatId);
    if (!chat) {
        return [`- chatId: ${input.chatId}`];
    }
    const description = chat.kind === 'dm' ? null : readChatDescription(chat.metadata);
    const kind =
        chat.kind === 'dm'
            ? 'a direct message between you and the user'
            : `the "${chat.title}" channel${description ? ` — ${description}` : ''}`;
    const participants = chat.participants.map((participant) => {
        if (participant.id === input.agentParticipantId) {
            return participantLine(participant.label ?? input.agent.name, '(you)', input.agent.bio);
        }
        if (participant.kind === 'agent') {
            const agentId = participantAgentId(participant.metadata);
            const agent = agentId ? getStoredAgent(agentId) : null;
            const name = participant.label ?? agent?.name ?? participant.id;
            const title = agentId ? `[${name}](agent://${agentId})` : name;
            return participantLine(title, '(agent)', agent?.bio);
        }
        return participantLine(participant.label ?? participant.id, null, null);
    });
    return [`- this is ${kind} (chatId: ${input.chatId})`, '- participants:', ...participants];
}

function participantLine(name: string, tag: string | null, bio: string | null | undefined) {
    const title = tag ? `${name} ${tag}` : name;
    return bio ? `  - ${title} — ${bio}` : `  - ${title}`;
}

function participantAgentId(metadata: Record<string, unknown>) {
    const agentId = metadata.agentId;
    return typeof agentId === 'string' && agentId.length > 0 ? agentId : null;
}

// The operator-authored channel description from the chat's Tavern metadata:
// it rides the identity line so the room's purpose frames every turn.
function readChatDescription(metadata: Record<string, unknown>) {
    const tavern =
        typeof metadata.tavern === 'object' && metadata.tavern !== null
            ? (metadata.tavern as Record<string, unknown>)
            : null;
    const description = tavern?.description;
    return typeof description === 'string' && description.trim() ? description.trim() : null;
}

// Unread counts for the agent's other chats, from the seen ledger. Counts
// only — bodies stay pull-based, and a count line never advances a cursor.
function pendingChatLines(input: AgentExecutorInput) {
    const lines: string[] = [];
    for (const chat of listChatsForAgentParticipant(input.agentParticipantId)) {
        if (chat.id === input.chatId || lines.length >= maxPendingChatLines) {
            continue;
        }
        const cursor = readSeenCursor(input.agentSession.id, chat.id);
        const latest = latestMessageSequence(chat.id);
        if (latest <= cursor) {
            continue;
        }
        const unseen = listRecentMessagesBetween(chat.id, {
            afterSequence: cursor,
            beforeSequence: latest + 1,
            limit: maxAmbientContextMessages + 1,
        }).filter((message) => isAmbientPromptMessage(input, message));
        if (unseen.length === 0) {
            continue;
        }
        const latestSender = unseen.at(-1)?.author.label ?? unseen.at(-1)?.author.id ?? 'unknown';
        const count =
            unseen.length > maxAmbientContextMessages
                ? `${maxAmbientContextMessages}+`
                : String(unseen.length);
        const title = chat.title ?? chat.id;
        lines.push(
            `- "${title}" (chatId: ${chat.id}): ${count} unread, latest from ${latestSender}`
        );
    }
    return lines;
}

// One line per settled dispatched turn: who, where (when cross-chat), how it
// ended, and the reply message id so the reply is one chat_message_get away.
function formatOutcomeNote(note: AgentTurnOutcomeNote, currentChatId: string, timezone: string) {
    const name = getStoredAgent(note.targetAgentId)?.name ?? note.targetAgentId;
    const where =
        note.targetChatId === currentChatId
            ? ''
            : ` in "${getChat(note.targetChatId)?.title ?? note.targetChatId}"`;
    const outcome =
        note.status === 'completed'
            ? `completed — reply message ${note.replyMessageId}`
            : note.status === 'no_reply'
              ? 'completed silently (NO_REPLY)'
              : note.status === 'stopped'
                ? 'was stopped before finishing'
                : `failed: ${note.error ?? 'unknown error'}`;
    return `- [${promptTimestamp(note.createdAt, timezone)}] ${name}'s turn${where} ${outcome}.`;
}

// Exported for busy delivery: mid-turn notices reuse the exact catch-up
// line format so the model reads one message shape everywhere.
export function formatPromptMessage(message: TavernChatMessage, timezone: string) {
    const label = message.author.label ?? message.author.id;
    return `[seq:${message.sequence} ${promptTimestamp(message.created_at, timezone)}] ${label}: ${message.content}`;
}

// Weekday + home-timezone wall clock at second precision: recency cues the
// model can weigh without doing offset math.
function promptTimestamp(iso: string, timezone: string) {
    return formatLocalTimestampWithWeekday(new Date(iso), timezone);
}

function formatPromptMessageContent(input: AgentExecutorInput, timezone: string) {
    const request = getMessage(input.requestMessageId);
    if (request) {
        const projectedContent = projectTavernMessageForAgent({
            content: request.content,
            enabledSkillIds: input.agent.enabledSkillIds,
        });
        return formatPromptMessage({ ...request, content: projectedContent }, timezone);
    }
    return projectTavernMessageForAgent({
        content: input.content,
        enabledSkillIds: input.agent.enabledSkillIds,
    });
}
