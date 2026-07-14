import { upsertResponseActivity } from './chat-api/index.ts';

// Steering evidence for a running turn. The agent engine cannot inject text
// into a live model turn yet, so an accepted steer records a notice activity
// on the running response: the chat shows what was steered and when, and the
// steered text reaches the seat's next prompt through normal chat context.
// Both steering entrances (user steering via the chat composer and agent
// steering via chat_send mode "steer") write through this module, so a future
// real mid-turn injection lands in one place.

export function recordUserSteerNotice(input: {
    agentId?: string | null;
    agentSessionId?: string | null;
    chatId: string;
    content: string;
    messageId?: string | null;
    responseId: string;
    runId: string;
}) {
    writeSteerActivity({
        activityId: userSteerNoticeActivityId(input.runId),
        agentId: input.agentId ?? undefined,
        agentSessionId: input.agentSessionId ?? null,
        chatId: input.chatId,
        content: input.content,
        messageId: input.messageId ?? undefined,
        noticeId: 'runtime_notice_steered',
        responseId: input.responseId,
        runId: input.runId,
        text: `Steered active turn: ${input.content}`,
    });
}

export function recordAgentSteerNotice(input: {
    content: string;
    messageId: string;
    steeredBy: { agentId: string; name: string };
    targetTurn: {
        agentId: string;
        agentSessionId: string;
        chatId: string;
        id: string;
        responseId: string;
    };
    // Unique per steer so repeated steers at one turn never overwrite.
    suffix: string;
}) {
    const activityId = agentSteerNoticeActivityId(input.targetTurn.id, input.suffix);
    writeSteerActivity({
        activityId,
        agentId: input.targetTurn.agentId,
        agentSessionId: input.targetTurn.agentSessionId,
        chatId: input.targetTurn.chatId,
        content: input.content,
        messageId: input.messageId,
        noticeId: 'runtime_notice_agent_steered',
        responseId: input.targetTurn.responseId,
        runId: input.targetTurn.id,
        steeredBy: input.steeredBy,
        text: `${input.steeredBy.name} steered the active turn: ${input.content}`,
    });
    return activityId;
}

export function userSteerNoticeActivityId(runId: string) {
    return sanitizeActivityId(`act_${runId}_runtime_notice_steered`);
}

function agentSteerNoticeActivityId(targetRunId: string, suffix: string) {
    return sanitizeActivityId(`act_${targetRunId}_agent_steered_${suffix}`);
}

function writeSteerActivity(input: {
    activityId: string;
    agentId: string | undefined;
    agentSessionId: null | string;
    chatId: string;
    content: string;
    messageId: string | undefined;
    noticeId: 'runtime_notice_agent_steered' | 'runtime_notice_steered';
    responseId: string;
    runId: string;
    steeredBy?: { agentId: string; name: string };
    text: string;
}) {
    const now = new Date().toISOString();
    upsertResponseActivity(input.chatId, input.responseId, {
        completed_at: now,
        detail: input.content,
        id: input.activityId,
        kind: 'custom',
        metadata: {
            runtime: {
                agentId: input.agentId,
                engine: 'agent-engine',
                messageId: input.messageId,
                notice: {
                    detail: input.content,
                    id: input.noticeId,
                    kind: 'status',
                    sessionId: input.agentSessionId,
                    text: input.text,
                    title: 'Steered active turn',
                },
                runId: input.runId,
                source: 'agent-engine',
                ...(input.steeredBy ? { steeredBy: { agentId: input.steeredBy.agentId } } : {}),
            },
        },
        started_at: now,
        status: 'completed',
        title: 'Steered active turn',
    });
}

function sanitizeActivityId(value: string) {
    return value.replace(/[^A-Za-z0-9_-]/g, '_');
}
