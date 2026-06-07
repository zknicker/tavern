import { createTavernClient } from '@tavern/sdk';

export function createTavernPluginApi({ baseUrl, fetch } = {}) {
    if (!baseUrl) {
        throw new Error('TAVERN_API_BASE_URL is required for Tavern API writes.');
    }

    const client = createTavernClient({
        baseUrl,
        fetch,
    });

    return {
        async getChat(chatId) {
            return client.chat.get(chatId);
        },
        async listChats(input = {}) {
            return client.chat.list(input);
        },
        async listMessages(chatId, input = {}) {
            return client.chat.messages(chatId, input);
        },
        async getMessage(messageId) {
            return client.message.get(messageId);
        },
        async searchMessages(chatId, input) {
            return client.chat.searchMessages(chatId, input);
        },
        async createDelivery(input) {
            const delivery = await client.chat.createDelivery(input.chatId, {
                agent_id: agentParticipantId(input.agentId),
                id: input.deliveryId,
                message: {
                    author_id: agentParticipantId(input.agentId),
                    content: input.text,
                    id: input.messageId,
                    metadata: runtimeMetadata(input),
                    role: 'assistant',
                },
                metadata: runtimeMetadata(input),
                turn_id: input.runId,
            });
            await client.chat.upsertResponse(input.chatId, {
                completed_at: new Date().toISOString(),
                id: responseId(input.runId),
                metadata: runtimeMetadata(input),
                participant_id: agentParticipantId(input.agentId),
                request_message_id: input.requestMessageId ?? null,
                response_message_id: input.messageId,
                status: 'completed',
                summary: null,
            });
            return delivery;
        },
        async updateTurnActivity(turn, input = {}) {
            const response = await client.chat.upsertResponse(turn.chatId, {
                id: responseId(turn.runId),
                metadata: turnMetadata(turn),
                participant_id: agentParticipantId(turn.agentId),
                request_message_id: turn.messageId,
                status: input.status ?? 'running',
                summary: input.summary ?? null,
            });

            if (!input.step) {
                return response;
            }

            return client.chat.upsertResponseActivity(
                turn.chatId,
                response.id,
                activityStepWithTurnMetadata(input.step, turn)
            );
        },
    };
}

export function deriveTavernApiBaseUrl(relayUrl) {
    const url = new URL(relayUrl);

    url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
    url.pathname = '';
    url.search = '';
    url.hash = '';

    return url.toString().replace(/\/$/u, '');
}

export function activityStepFromProgressStep(step, timestamp = new Date().toISOString()) {
    const stepMetadata =
        step.metadata && typeof step.metadata === 'object' && !Array.isArray(step.metadata)
            ? step.metadata
            : {};
    const stepRuntimeMetadata =
        stepMetadata.runtime &&
        typeof stepMetadata.runtime === 'object' &&
        !Array.isArray(stepMetadata.runtime)
            ? stepMetadata.runtime
            : {};
    const metadata = {
        ...stepMetadata,
        ...(step.detail ? { detail: step.detail } : {}),
        ...(step.toolCallId ? { toolCallId: step.toolCallId } : {}),
        ...(step.toolName ? { toolName: step.toolName } : {}),
        runtime: {
            ...stepRuntimeMetadata,
            ...(step.rawOpenClawIds ? { openClawIds: step.rawOpenClawIds } : {}),
            ...(step.toolCallId ? { toolCallId: step.toolCallId } : {}),
            ...(step.toolName ? { toolName: step.toolName } : {}),
        },
        tool: {
            arguments: step.arguments ?? null,
            name: step.toolName ?? null,
            result: step.result ?? null,
        },
    };

    return {
        completed_at: step.status === 'active' ? null : timestamp,
        detail: step.detail ?? null,
        id: activityId(step.id),
        kind: activityStepKind(step.kind),
        metadata,
        started_at: timestamp,
        status: step.status === 'active' ? 'running' : step.status,
        title: step.label,
    };
}

function activityId(id) {
    return id.startsWith('act_') ? id : `act_${id.replace(/[^A-Za-z0-9_-]/gu, '_')}`;
}

function responseId(runId) {
    return runId.startsWith('rsp_') ? runId : `rsp_${runId.replace(/[^A-Za-z0-9_-]/gu, '_')}`;
}

function activityStepKind(kind) {
    if (kind === 'approval') {
        return 'approval';
    }
    if (kind === 'artifact') {
        return 'artifact';
    }
    if (kind === 'reasoning') {
        return 'reasoning';
    }
    if (kind === 'plan') {
        return 'planning';
    }
    if (kind === 'command') {
        return 'command';
    }
    if (kind === 'message') {
        return 'message';
    }
    if (kind === 'custom') {
        return 'custom';
    }
    return 'tool_call';
}

function turnMetadata(turn) {
    return {
        runtime: {
            agentId: turn.agentId,
            messageId: turn.messageId,
            runId: turn.runId,
            sessionKey: turn.sessionKey,
            source: 'openclaw',
            startedAt: turn.startedAt,
        },
    };
}

function runtimeMetadata(input) {
    return {
        runtime: {
            agentId: input.agentId,
            deliveryId: input.deliveryId,
            runId: input.runId,
            sessionKey: input.sessionKey,
            source: 'openclaw',
        },
    };
}

function activityStepWithTurnMetadata(step, turn) {
    const metadata =
        step.metadata && typeof step.metadata === 'object' && !Array.isArray(step.metadata)
            ? step.metadata
            : {};
    const runtime =
        metadata.runtime && typeof metadata.runtime === 'object' && !Array.isArray(metadata.runtime)
            ? metadata.runtime
            : {};

    return {
        ...step,
        id: turnActivityId(turn.runId, step.id),
        metadata: {
            ...metadata,
            runtime: {
                ...runtime,
                agentId: turn.agentId,
                messageId: turn.messageId,
                runId: turn.runId,
                sessionKey: turn.sessionKey,
                source: 'openclaw',
                startedAt: turn.startedAt,
            },
        },
    };
}

function turnActivityId(runId, stepId) {
    const activity = stripActivityPrefix(stepId);
    return activityId(`${runId}_${activity}`);
}

function stripActivityPrefix(id) {
    return id.startsWith('act_') ? id.slice('act_'.length) : id;
}

function agentParticipantId(agentId) {
    return agentId.startsWith('agt_') ? agentId : `agt_${agentId.replace(/[^A-Za-z0-9_-]/gu, '_')}`;
}
