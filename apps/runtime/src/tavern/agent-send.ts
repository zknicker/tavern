import * as z from 'zod';
import { AgentApiError } from './agent-api-errors.ts';
import { retractComposition } from './agent-compositions.ts';
import { clearAgentDraft, readAgentDraft, saveAgentDraft } from './agent-drafts.ts';
import { countFormalMentions, toAgentMessage } from './agent-messages.ts';
import { ensureCurrentAgentSession } from './agent-session-store.ts';
import { resolveAgentTarget } from './agent-targets.ts';
import { getStoredAgent } from './agents-store.ts';
import { createAgentParticipantId } from './chat-api/ids.ts';
import {
    createMessage,
    createMessageId,
    findMessageByNonce,
    membershipChat,
} from './chat-api/index.ts';
import { isArchivedChat } from './chat-guards.ts';
import { collectRecentUnread, resolveSendHold } from './send-hold.ts';

export const agentSendRequestSchema = z
    .object({
        attachmentIds: z.array(z.string().regex(/^att_[A-Za-z0-9_-]+$/u)).optional(),
        compositionId: z.string().min(1).optional(),
        content: z.string().optional(),
        continueAnyway: z.boolean().optional(),
        nonce: z.string().min(1).optional(),
        sendDraft: z.boolean().optional(),
        target: z.string().min(1),
    })
    .strict();

export type AgentSendRequest = z.infer<typeof agentSendRequestSchema>;

export function sendAgentMessage(
    agentId: string,
    input: AgentSendRequest,
    options: { onTargetResolved?(chatId: string): void } = {}
) {
    validateSendMode(input);
    const plainContent = input.sendDraft ? null : requireContent(input.content);
    const resolved = resolveAgentTarget({
        agentId,
        createDm: !input.sendDraft,
        // Releasing a draft is a lookup, not a first reply: if the thread does
        // not exist, fail without leaving an empty followed thread behind.
        createThread: !input.sendDraft,
        target: input.target,
    });
    options.onTargetResolved?.(resolved.chat.id);
    const agent = getStoredAgent(agentId);
    if (!agent) {
        throw new AgentApiError('SEND_FAILED', 'Calling agent was not found.', 404);
    }
    // Archival lives on the membership authority: a thread is archived
    // exactly when its parent is.
    const archivalChat = membershipChat(resolved.chat) ?? resolved.chat;
    if (isArchivedChat(archivalChat)) {
        throw new AgentApiError(
            'TARGET_ARCHIVED',
            `${resolved.target} is archived; writes there are rejected.`,
            409
        );
    }
    const session = ensureCurrentAgentSession({ agentId });
    const participantId = createAgentParticipantId(agentId);
    // A same-nonce retry of a committed send stays idempotent even when newer
    // peer traffic would otherwise hold it (the original send already passed
    // the gate) and even when the committed draft has since been cleared —
    // checked before draft resolution so retries never see SEND_DRAFT_NOT_FOUND.
    const committed = input.nonce ? findMessageByNonce(resolved.chat.id, input.nonce) : null;
    if (committed) {
        // Idempotency covers retries of the same logical send only — a nonce
        // pointing at someone else's message or different content is a caller
        // bug, never a receipt.
        if (
            committed.author.id !== participantId ||
            (plainContent !== null && committed.content !== plainContent)
        ) {
            throw new AgentApiError(
                'SEND_FAILED',
                'This nonce was already used for a different message.',
                409
            );
        }
        return sentResponse(agentId, committed, {
            chatId: resolved.chat.id,
            participantId,
            sessionId: session.id,
        });
    }
    const storedDraft = readAgentDraft(agentId, resolved.chat.id);
    const outgoing = input.sendDraft
        ? requireDraft(storedDraft)
        : {
              attachmentIds: input.attachmentIds ?? [],
              content: plainContent ?? '',
              reholdCount: storedDraft?.reholdCount ?? 0,
          };
    if (input.continueAnyway && outgoing.reholdCount < 2) {
        // The escape hatch is earned by repeated holds; the server enforces it,
        // not just the CLI's teaching.
        throw new AgentApiError(
            'SEND_ANYWAY_NOT_ELIGIBLE',
            'continueAnyway is only available after repeated holds of the same draft.',
            409
        );
    }
    const hold = input.continueAnyway
        ? null
        : resolveSendHold({
              agentId,
              chatId: resolved.chat.id,
              participantId,
              sessionId: session.id,
          });
    if (hold) {
        // A held send never publishes its composition commit — the app's
        // provisional bubble retracts (I1 freshness-hold path).
        if (input.compositionId) {
            retractComposition({ agentId, compositionId: input.compositionId });
        }
        const draft = saveAgentDraft({
            agentId,
            attachmentIds: outgoing.attachmentIds,
            chatId: resolved.chat.id,
            content: outgoing.content,
            reholdCount: outgoing.reholdCount + 1,
        });
        return {
            continueAnywaySuggested: draft.reholdCount >= 2,
            formalMentionCount: countFormalMentions(hold.shownMessages, {
                agentId,
                handle: agent.name,
            }),
            newMessageCount: hold.newMessageCount,
            omittedMessageCount: hold.omittedMessageCount,
            reholdCount: draft.reholdCount,
            shownMessages: hold.shownMessages.map((message) => toAgentMessage(message)),
            state: 'held' as const,
        };
    }
    const metadata = {
        ...(input.compositionId ? { compositionId: input.compositionId } : {}),
        runtime: { agentId, source: 'agent-api' },
    };
    const receipt = createMessage(resolved.chat.id, {
        attachments: outgoing.attachmentIds.map((id) => ({ id })),
        author_id: participantId,
        content: outgoing.content,
        id: createMessageId(),
        metadata,
        nonce: input.nonce,
        role: 'assistant',
    });
    clearAgentDraft(agentId, resolved.chat.id);
    return sentResponse(agentId, receipt.message, {
        chatId: resolved.chat.id,
        participantId,
        sessionId: session.id,
    });
}

function sentResponse(
    agentId: string,
    message: Parameters<typeof toAgentMessage>[0],
    context: { chatId: string; participantId: string; sessionId: string }
) {
    const recentUnread = collectRecentUnread({
        agentId,
        excludeChatId: context.chatId,
        participantId: context.participantId,
        sessionId: context.sessionId,
    });
    return {
        message: toAgentMessage(message),
        recentUnread: recentUnread.map((row) => ({
            message: toAgentMessage(row.message),
            target: row.target,
        })),
        state: 'sent' as const,
    };
}

function validateSendMode(input: AgentSendRequest): void {
    if (input.continueAnyway && !input.sendDraft) {
        throw new AgentApiError(
            'SEND_DRAFT_ANYWAY_REQUIRES_SEND_DRAFT',
            'continueAnyway requires sendDraft.',
            400
        );
    }
    if (input.sendDraft && input.content !== undefined) {
        throw new AgentApiError(
            'SEND_DRAFT_STDIN_UNSUPPORTED',
            'sendDraft does not accept content.',
            400
        );
    }
    if (input.sendDraft && (input.attachmentIds?.length ?? 0) > 0) {
        throw new AgentApiError(
            'SEND_DRAFT_ATTACHMENTS_UNSUPPORTED',
            'sendDraft does not accept attachment ids.',
            400
        );
    }
}

function requireContent(content: string | undefined): string {
    if (!content?.trim()) {
        throw new AgentApiError('MISSING_CONTENT', 'Message content is required.', 400);
    }
    return content;
}

function requireDraft(draft: ReturnType<typeof readAgentDraft>) {
    if (!draft) {
        throw new AgentApiError(
            'SEND_DRAFT_NOT_FOUND',
            'No saved draft exists for this target.',
            404
        );
    }
    return draft;
}
