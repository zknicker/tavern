import type { AgentRuntimeCreateMessage } from '@tavern/api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { setModelProviderEnabled } from '../models/provider-store.ts';
import type { AgentExecutor, AgentExecutorInput, AgentExecutorResult } from './agent-executor';
import { resetAgentExecutorForTesting, setAgentExecutorForTesting } from './agent-turn-runner.ts';
import { listAgentTurnsForSession } from './agent-turn-store.ts';
import { upsertStoredAgent } from './agents-store.ts';
import { sendTavernChannelMessage, stopTavernChannelTurn } from './channel-relay.ts';
import {
    createChat,
    createDelivery,
    getResponse,
    getResponseActivity,
    listEvents,
    listMessages,
    upsertResponse,
    upsertResponseActivity,
} from './chat-api/index.ts';

describe('Tavern channel relay', () => {
    const originalClaudeCommand = process.env.TAVERN_AGENT_CLAUDE_CODE_COMMAND;

    beforeEach(async () => {
        ensureRuntimeSchema(initTestDb());
        process.env.TAVERN_AGENT_CLAUDE_CODE_COMMAND = process.execPath;
        await setModelProviderEnabled({ enabled: true, providerId: 'claude' });
        resetAgentExecutorForTesting();
    });

    afterEach(() => {
        restoreEnv('TAVERN_AGENT_CLAUDE_CODE_COMMAND', originalClaudeCommand);
        resetAgentExecutorForTesting();
        closeDb();
    });

    it('accepts a message, records a durable agent turn, and completes through the fake executor', async () => {
        createAgentChat('agt_primary');
        setAgentExecutorForTesting(createFakeAgentExecutor());

        const accepted = await sendTavernChannelMessage('cht_general', messageInput());

        expect(accepted).toMatchObject({
            runId: 'run_1',
            status: 'accepted',
        });

        await waitFor(() => getResponse('rsp_run_1')?.status === 'completed');

        const sessionId = 'ags_cht_general_agt_primary_1';
        expect(listAgentTurnsForSession(sessionId)).toMatchObject([
            {
                activityIds: ['act_run_1_fake_executor'],
                agentId: 'agt_primary',
                agentParticipantId: 'agt_primary',
                agentSessionId: sessionId,
                attempt: 1,
                chatId: 'cht_general',
                id: 'run_1',
                outputMessageIds: ['msg_run_1_fake_executor'],
                responseId: 'rsp_run_1',
                status: 'completed',
                triggerMessageId: 'msg_1',
            },
        ]);
        expect(getResponse('rsp_run_1')).toMatchObject({
            participant_id: 'agt_primary',
            request_message_id: 'msg_1',
            response_message_id: 'msg_run_1_fake_executor',
            status: 'completed',
        });
        expect(getResponseActivity('act_run_1_fake_executor')).toMatchObject({
            response_id: 'rsp_run_1',
            status: 'completed',
            title: 'Fake executor',
        });
        expect(listMessages('cht_general').messages.map((message) => message.id)).toEqual([
            'msg_1',
            'msg_run_1_fake_executor',
        ]);
        expect(listEvents().events.map((event) => event.type)).toEqual([
            'message.created',
            'response.created',
            'activity.created',
            'message.delivered',
            'response.completed',
        ]);
    });

    it('runs at most one active turn for one agent seat and queues the next addressed message', async () => {
        createAgentChat('agt_primary');
        const executor = createControlledExecutor();
        setAgentExecutorForTesting(executor);

        await sendTavernChannelMessage('cht_general', messageInput({ messageId: 'msg_1' }));
        await waitFor(() => executor.startedRunIds().includes('run_1'));
        await sendTavernChannelMessage(
            'cht_general',
            messageInput({ messageId: 'msg_2', nonce: 'nonce_2' })
        );

        expect(executor.startedRunIds()).toEqual(['run_1']);
        expect(listAgentTurnsForSession('ags_cht_general_agt_primary_1')).toMatchObject([
            { id: 'run_1', status: 'running' },
            { id: 'run_2', status: 'queued' },
        ]);

        executor.resolveRun('run_1', { activityIds: [], outputMessageIds: [] });
        await waitFor(() => executor.startedRunIds().includes('run_2'));

        expect(listAgentTurnsForSession('ags_cht_general_agt_primary_1')).toMatchObject([
            { id: 'run_1', status: 'completed' },
            { id: 'run_2', status: 'running' },
        ]);
    });

    it('allows different agent seats in the same chat to execute concurrently', async () => {
        createAgentChat('agt_alpha', 'agt_beta');
        const executor = createControlledExecutor();
        setAgentExecutorForTesting(executor);

        await sendTavernChannelMessage(
            'cht_general',
            messageInput({ agentId: 'agt_alpha', messageId: 'msg_alpha', nonce: 'nonce_alpha' })
        );
        await sendTavernChannelMessage(
            'cht_general',
            messageInput({ agentId: 'agt_beta', messageId: 'msg_beta', nonce: 'nonce_beta' })
        );

        await waitFor(() => executor.startedRunIds().length === 2);

        expect(executor.startedRunIds().sort()).toEqual(['run_alpha', 'run_beta']);
        expect(listAgentTurnsForSession('ags_cht_general_agt_alpha_1')).toMatchObject([
            { id: 'run_alpha', status: 'running' },
        ]);
        expect(listAgentTurnsForSession('ags_cht_general_agt_beta_1')).toMatchObject([
            { id: 'run_beta', status: 'running' },
        ]);
    });

    it('exposes stop as a Runtime command for active turns', async () => {
        createAgentChat('agt_primary');
        const executor = createControlledExecutor();
        setAgentExecutorForTesting(executor);

        await sendTavernChannelMessage('cht_general', messageInput());
        await waitFor(() => executor.startedRunIds().includes('run_1'));

        const result = await stopTavernChannelTurn({ runId: 'run_1' });

        expect(result).toEqual({ runId: 'run_1', stopped: true });
        expect(executor.stoppedRunIds()).toEqual(['run_1']);
        expect(listAgentTurnsForSession('ags_cht_general_agt_primary_1')).toMatchObject([
            { id: 'run_1', status: 'cancelled' },
        ]);
        expect(getResponse('rsp_run_1')).toMatchObject({
            status: 'cancelled',
            summary: 'Turn stopped.',
        });
    });

    it('records executor failures as Tavern-native failed responses', async () => {
        createAgentChat('agt_primary');
        const executor = createControlledExecutor();
        setAgentExecutorForTesting(executor);

        await sendTavernChannelMessage('cht_general', messageInput());
        await waitFor(() => executor.startedRunIds().includes('run_1'));

        executor.rejectRun('run_1', new Error('model call failed'));

        await waitFor(() => getResponse('rsp_run_1')?.status === 'failed');
        expect(listAgentTurnsForSession('ags_cht_general_agt_primary_1')).toMatchObject([
            { id: 'run_1', metadata: { error: 'model call failed' }, status: 'failed' },
        ]);
        expect(getResponse('rsp_run_1')).toMatchObject({
            request_message_id: 'msg_1',
            status: 'failed',
            summary: 'model call failed',
        });
    });

    it('serializes non-Error executor failures into readable response summaries', async () => {
        createAgentChat('agt_primary');
        const executor = createControlledExecutor();
        setAgentExecutorForTesting(executor);

        await sendTavernChannelMessage('cht_general', messageInput());
        await waitFor(() => executor.startedRunIds().includes('run_1'));

        executor.rejectRun('run_1', { code: 'auth_failed', message: 'Provider auth failed' });

        await waitFor(() => getResponse('rsp_run_1')?.status === 'failed');
        expect(listAgentTurnsForSession('ags_cht_general_agt_primary_1')).toMatchObject([
            {
                id: 'run_1',
                metadata: {
                    error: '{"code":"auth_failed","message":"Provider auth failed"}',
                },
                status: 'failed',
            },
        ]);
        expect(getResponse('rsp_run_1')).toMatchObject({
            status: 'failed',
            summary: '{"code":"auth_failed","message":"Provider auth failed"}',
        });
    });
});

function createAgentChat(...agentIds: string[]) {
    for (const agentId of agentIds) {
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: agentId,
                isAdmin: false,
                name: agentId,
                primaryColor: null,
                workspaceFolder: `/tmp/${agentId}`,
            },
        });
    }

    createChat({
        id: 'cht_general',
        kind: 'channel',
        participants: [
            {
                id: 'usr_tavern',
                kind: 'user',
                label: 'You',
                metadata: {},
            },
            ...agentIds.map((agentId) => ({
                id: agentId,
                kind: 'agent' as const,
                label: agentId,
                metadata: { agentId },
            })),
        ],
        title: 'General',
    });
}

function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) {
        delete process.env[name];
        return;
    }
    process.env[name] = value;
}

function messageInput(input?: {
    agentId?: string;
    messageId?: string;
    nonce?: string;
}): AgentRuntimeCreateMessage {
    return {
        agent: {
            agentId: input?.agentId ?? 'agt_primary',
        },
        message: {
            content: 'hello',
            id: input?.messageId ?? 'msg_1',
            nonce: input?.nonce ?? 'nonce_1',
        },
        target: {
            externalId: null,
            target: 'cht_general',
            type: 'tavern',
        },
    };
}

function createControlledExecutor() {
    const started: string[] = [];
    const stopped: string[] = [];
    const pending = new Map<
        string,
        {
            reject: (error: unknown) => void;
            resolve: (result: AgentExecutorResult) => void;
        }
    >();

    const executor: AgentExecutor & {
        rejectRun: (runId: string, error: unknown) => void;
        resolveRun: (runId: string, result: AgentExecutorResult) => void;
        startedRunIds: () => string[];
        stoppedRunIds: () => string[];
    } = {
        async execute(input: AgentExecutorInput) {
            started.push(input.runId);
            return await new Promise<AgentExecutorResult>((resolve, reject) => {
                pending.set(input.runId, { reject, resolve });
            });
        },
        rejectRun(runId, error) {
            pending.get(runId)?.reject(error);
            pending.delete(runId);
        },
        resolveRun(runId, result) {
            pending.get(runId)?.resolve(result);
            pending.delete(runId);
        },
        startedRunIds() {
            return [...started];
        },
        stop(runId) {
            stopped.push(runId);
            return true;
        },
        stoppedRunIds() {
            return [...stopped];
        },
    };

    return executor;
}

function createFakeAgentExecutor(): AgentExecutor {
    return {
        async execute(input) {
            const now = new Date().toISOString();
            const activityId = fakeActivityId(input.runId);
            const messageId = fakeOutputMessageId(input.runId);
            const deliveryId = fakeDeliveryId(input.runId);
            const runtime = {
                agentId: input.agent.id,
                agentSessionId: input.agentSession.id,
                engine: 'agent-engine',
                messageId: input.requestMessageId,
                runId: input.runId,
                source: 'agent-engine',
            };

            upsertResponseActivity(input.chatId, input.responseId, {
                completed_at: now,
                detail: 'Generated a deterministic fake agent response.',
                id: activityId,
                kind: 'message',
                metadata: { runtime },
                started_at: now,
                status: 'completed',
                title: 'Fake executor',
            });

            const receipt = createDelivery(input.chatId, {
                agent_id: input.agentSession.agentParticipantId,
                id: deliveryId,
                message: {
                    attachments: [],
                    author_id: input.agentSession.agentParticipantId,
                    content: fakeResponseContent(input),
                    id: messageId,
                    metadata: { runtime },
                    role: 'assistant',
                },
                metadata: { runtime },
                turn_id: input.runId,
            });

            upsertResponse(input.chatId, {
                completed_at: now,
                id: input.responseId,
                metadata: {
                    runtime: {
                        ...runtime,
                        completedAt: now,
                    },
                },
                participant_id: input.agentSession.agentParticipantId,
                request_message_id: input.requestMessageId,
                response_message_id: receipt.message.id,
                status: 'completed',
                summary: 'Fake executor completed.',
            });

            return {
                activityIds: [activityId],
                outputMessageIds: [receipt.message.id],
            };
        },
        stop() {
            return true;
        },
    };
}

function fakeResponseContent(input: AgentExecutorInput) {
    const quoted = input.content.trim() || 'your message';
    return `${input.agent.name}: received "${quoted}".`;
}

function fakeActivityId(runId: string) {
    return `act_${runId}_fake_executor`.replace(/[^A-Za-z0-9_-]/g, '_');
}

function fakeDeliveryId(runId: string) {
    return `del_${runId}_fake_executor`.replace(/[^A-Za-z0-9_-]/g, '_');
}

function fakeOutputMessageId(runId: string) {
    return `msg_${runId}_fake_executor`.replace(/[^A-Za-z0-9_-]/g, '_');
}

async function waitFor(assertion: () => boolean, timeoutMs = 1000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (assertion()) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('Timed out waiting for assertion.');
}
