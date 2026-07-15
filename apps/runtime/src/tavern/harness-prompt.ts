import type { TavernChatMessage } from '@tavern/api';
import { formatLocalTimestampWithWeekday } from '../timezone.ts';
import { resolveHomeTimezone } from '../timezone-settings.ts';
import type { AgentExecutorInput } from './agent-executor.ts';
import { getStoredAgent } from './agents-store.ts';
import { getChat, getMessage, listRecentMessagesBetween } from './chat-api/index.ts';
import { projectTavernMessageForAgent } from './mention-projection.ts';
import { type AgentTurnOutcomeNote, consumeAgentTurnOutcomeNotes } from './turn-outcome-notes.ts';

const maxAmbientContextMessages = 20;

export function harnessPrompt(input: AgentExecutorInput, recallContext?: null | string) {
    const timezone = resolveHomeTimezone();
    const context = buildHarnessPromptContext(input);
    const sections = [
        'This turn:',
        `- current time: ${promptTimestamp(new Date().toISOString(), timezone)}`,
        context.currentMessage
            ? `- triggering message: ${input.requestMessageId} (seq ${context.currentMessage.sequence})`
            : `- triggering message: ${input.requestMessageId}`,
    ];

    // First turn of a rotated session: no engine session exists yet, so prior
    // conversation is genuinely absent — say so instead of letting the model
    // guess. New seats (generation 1) get channel catch-up instead.
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
            'Channel messages since your last turn:',
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

    sections.push(
        '',
        `New message for ${input.agent.name}:`,
        formatPromptMessageContent(input, timezone)
    );

    return sections.join('\n');
}

export function promptCursorSequence(input: AgentExecutorInput) {
    const request = getMessage(input.requestMessageId);
    return request?.sequence ?? input.agentSession.promptContextSequence;
}

function buildHarnessPromptContext(input: AgentExecutorInput) {
    const request = getMessage(input.requestMessageId);
    const chat = getChat(input.chatId);
    const ambientCandidates =
        request && chat?.kind === 'channel'
            ? listRecentMessagesBetween(input.chatId, {
                  afterSequence: input.agentSession.promptContextSequence,
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
    return message.author.id !== input.agentSession.agentParticipantId;
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
