import { startNewAgentSession } from './agent-session-store.ts';
import { createAgentParticipantId } from './chat-api/ids.ts';
import { latestMessageSequence, upsertResponse, upsertResponseActivity } from './chat-api/index.ts';

/**
 * Rotates the agent seat's current Agent session so the chat's next message
 * opens a brand-new engine session. The timeline stays untouched; the reset
 * lands as a durable new-session notice row so every client can see when
 * fresh context started. See specs/agent-drawer.md.
 */
export function resetAgentSession(input: { agentId: string; chatId: string; noticeText?: string }) {
    // Fresh context starts at the reset point: snapshot the cursor so the new
    // session's first turn does not replay pre-reset channel history.
    const session = startNewAgentSession({
        agentParticipantId: createAgentParticipantId(input.agentId),
        chatId: input.chatId,
        promptContextSequence: latestMessageSequence(input.chatId),
    });
    recordSessionResetNotice({
        agentId: input.agentId,
        chatId: input.chatId,
        sessionId: session.id,
        text: input.noticeText ?? 'Started a fresh session. New messages start with fresh context.',
    });
    return { session };
}

// Evidence is written after the reset settles so the timeline never shows an
// in-flight row for it.
function recordSessionResetNotice(input: {
    agentId: string;
    chatId: string;
    sessionId: string;
    text: string;
}) {
    const responseId = `rsp_session_${crypto.randomUUID()}`;
    const participantId = createAgentParticipantId(input.agentId);
    const text = input.text;

    upsertResponse(input.chatId, {
        id: responseId,
        metadata: { runtime: { agentId: input.agentId, source: 'session-reset' } },
        participant_id: participantId,
        status: 'completed',
    });
    upsertResponseActivity(input.chatId, responseId, {
        detail: text,
        id: `act_${responseId}`,
        kind: 'custom',
        metadata: {
            runtime: {
                agentId: input.agentId,
                notice: {
                    detail: text,
                    id: 'runtime_notice_session_reset',
                    kind: 'new_session',
                    sessionId: input.sessionId,
                    text,
                    title: 'New session',
                },
                source: 'session-reset',
            },
        },
        status: 'completed',
        title: 'New session',
    });
}
