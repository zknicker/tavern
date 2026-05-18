import { createTavernClient } from '@tavern/sdk';

export function createTavernPluginApi({ baseUrl, fetch } = {}) {
    if (!baseUrl) {
        throw new Error('TAVERN_API_BASE_URL is required for Tavern API writes.');
    }

    const client = createTavernClient({
        baseUrl,
        fetch,
    });
    const activityByRun = new Map();

    return {
        createDelivery(input) {
            return client.chat.createDelivery(input.chatId, {
                agent_id: agentParticipantId(input.agentId),
                id: input.deliveryId,
                message: {
                    author_id: agentParticipantId(input.agentId),
                    id: input.messageId,
                    metadata: runtimeMetadata(input),
                    parts: [
                        {
                            content: input.text,
                            kind: 'text',
                        },
                    ],
                    role: 'assistant',
                },
                metadata: runtimeMetadata(input),
                turn_id: input.runId,
            });
        },
        updateTurnActivity(turn, input = {}) {
            const key = activityKey(turn);
            const current = activityByRun.get(key) ?? {
                summary: null,
                steps: [],
            };
            const nextSteps = mergeActivitySteps(current.steps, input.step);
            const next = {
                summary: input.summary === undefined ? current.summary : input.summary,
                steps: nextSteps,
            };

            activityByRun.set(key, next);

            return client.chat.updateActivity(turn.chatId, {
                agent_id: agentParticipantId(turn.agentId),
                metadata: {
                    runtime: {
                        agentId: turn.agentId,
                        messageId: turn.messageId,
                        sessionKey: turn.sessionKey,
                        source: 'openclaw',
                        startedAt: turn.startedAt,
                    },
                },
                run_id: turn.runId,
                status: input.status ?? 'running',
                steps: next.steps,
                summary: next.summary,
            });
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

function mergeActivitySteps(steps, step) {
    if (!step) {
        return steps;
    }

    const output = steps.filter((entry) => entry.id !== step.id);
    output.push(step);
    return output.sort((left, right) => left.started_at.localeCompare(right.started_at));
}

export function activityStepFromProgressStep(step, timestamp = new Date().toISOString()) {
    return {
        completed_at: step.status === 'active' ? null : timestamp,
        id: step.id,
        kind: activityStepKind(step.kind),
        label: step.label,
        metadata: step.detail ? { detail: step.detail } : {},
        started_at: timestamp,
        status: step.status === 'active' ? 'running' : step.status,
    };
}

function activityStepKind(kind) {
    if (kind === 'reasoning') {
        return 'thinking';
    }
    if (kind === 'plan') {
        return 'custom';
    }
    if (kind === 'tool' || kind === 'command' || kind === 'message') {
        return kind;
    }
    return 'custom';
}

function activityKey(turn) {
    return `${turn.chatId}:${turn.runId}`;
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

function agentParticipantId(agentId) {
    return agentId.startsWith('agt_') ? agentId : `agt_${agentId.replace(/[^A-Za-z0-9_-]/gu, '_')}`;
}
