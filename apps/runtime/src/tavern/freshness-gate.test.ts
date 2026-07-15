import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AgentRuntimeAgent, AgentRuntimeAgentSession } from '@tavern/api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { ensureCurrentAgentSession } from './agent-session-store.ts';
import { resetAgentExecutorForTesting, setAgentExecutorForTesting } from './agent-turn-runner.ts';
import { claimNextAgentTurnForSeat, createAgentTurn } from './agent-turn-store.ts';
import { upsertStoredAgent } from './agents-store.ts';
import { deliverToBusySeats, resetBusyDeliveryForTesting } from './busy-delivery.ts';
import {
    createChat,
    createMessage,
    getMessage,
    getResponse,
    getResponseActivity,
    upsertResponse,
} from './chat-api/index.ts';
import { resolveFreshnessHold } from './freshness-gate.ts';
import {
    createHarnessAgentExecutor,
    setHarnessAgentFactoryForTesting,
} from './harness-agent-executor.ts';

const now = '2026-06-29T12:00:00.000Z';

describe('freshness gate', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
        resetBusyDeliveryForTesting();
    });

    afterEach(() => {
        resetBusyDeliveryForTesting();
        resetAgentExecutorForTesting();
        closeDb();
    });

    describe('resolveFreshnessHold', () => {
        it('holds a channel reply when unseen peer messages landed', () => {
            seedChat('cht_gate', 'channel');
            seedMessage('cht_gate', 'msg_trigger', 'usr_alice', 'question?');
            seedMessage('cht_gate', 'msg_peer', 'usr_bob', 'Bob already answered.');

            const hold = resolveFreshnessHold(gateInput('cht_gate', 'msg_trigger'), 'Draft.');

            expect(hold).not.toBeNull();
            expect(hold?.unseen.map((message) => message.id)).toEqual(['msg_peer']);
            expect(hold?.prompt).toContain('held for freshness');
            expect(hold?.prompt).toContain('Bob already answered.');
            expect(hold?.prompt).toContain('Draft.');
            expect(hold?.prompt).toContain('reply exactly NO_REPLY');
        });

        it('does not hold in DMs, for own messages, or without unseen rows', () => {
            seedChat('cht_dm_gate', 'dm');
            seedMessage('cht_dm_gate', 'msg_dm_trigger', 'usr_alice', 'question?');
            seedMessage('cht_dm_gate', 'msg_dm_late', 'usr_alice', 'late row');
            expect(
                resolveFreshnessHold(gateInput('cht_dm_gate', 'msg_dm_trigger'), 'Draft.')
            ).toBeNull();

            seedChat('cht_own', 'channel');
            seedMessage('cht_own', 'msg_own_trigger', 'usr_alice', 'question?');
            seedMessage('cht_own', 'msg_own_late', 'agt_primary', 'my own narration', {
                role: 'assistant',
            });
            expect(
                resolveFreshnessHold(gateInput('cht_own', 'msg_own_trigger'), 'Draft.')
            ).toBeNull();

            seedChat('cht_fresh', 'channel');
            seedMessage('cht_fresh', 'msg_fresh_trigger', 'usr_alice', 'question?');
            expect(
                resolveFreshnessHold(gateInput('cht_fresh', 'msg_fresh_trigger'), 'Draft.')
            ).toBeNull();
        });

        it('treats busy-delivered sequences as seen', async () => {
            seedChat('cht_seen', 'channel');
            seedMessage('cht_seen', 'msg_seen_trigger', 'usr_alice', 'question?');
            const peer = seedMessage('cht_seen', 'msg_seen_peer', 'usr_bob', 'covered already');
            seedRunningTurn('cht_seen', 'msg_seen_trigger');
            setAgentExecutorForTesting({
                deliverUserMessage: () => true,
                execute: () => Promise.reject(new Error('not used')),
            });
            await deliverToBusySeats('cht_seen', peer);

            expect(
                resolveFreshnessHold(gateInput('cht_seen', 'msg_seen_trigger'), 'Draft.')
            ).toBeNull();
        });
    });

    describe('executor integration', () => {
        it('runs one held continuation and delivers the revised reply', async () => {
            const chatId = 'cht_gate_exec';
            seedChat(chatId, 'channel');
            seedMessage(chatId, 'msg_trigger', 'usr_alice', 'question?');
            seedMessage(chatId, 'msg_peer', 'usr_bob', 'Bob already answered.');
            const input = executorInput(chatId, 'msg_trigger');
            upsertResponse(chatId, {
                id: input.responseId,
                participant_id: 'agt_primary',
                request_message_id: 'msg_trigger',
                status: 'running',
            });

            const prompts: string[] = [];
            const restore = setHarnessAgentFactoryForTesting(
                fakeAgentFactory(prompts, ['Draft answer.', 'Revised answer.'])
            );
            try {
                const result = await createHarnessAgentExecutor().execute(input);

                expect(prompts).toHaveLength(2);
                expect(prompts[1]).toContain('held for freshness');
                expect(prompts[1]).toContain('Bob already answered.');
                expect(prompts[1]).toContain('Draft answer.');
                expect(result.outputMessageIds).toHaveLength(1);
                expect(getMessage(result.outputMessageIds[0] ?? '')?.content).toBe(
                    'Revised answer.'
                );
                const notice = getResponseActivity(`act_${input.runId}_freshness_hold`);
                expect(notice).toMatchObject({
                    status: 'completed',
                    title: 'Reply held for freshness review',
                });
            } finally {
                restore();
            }
        });

        it('lets a held turn decline with NO_REPLY', async () => {
            const chatId = 'cht_gate_silent';
            seedChat(chatId, 'channel');
            seedMessage(chatId, 'msg_trigger_s', 'usr_alice', 'question?');
            seedMessage(chatId, 'msg_peer_s', 'usr_bob', 'answered.');
            const input = executorInput(chatId, 'msg_trigger_s');
            upsertResponse(chatId, {
                id: input.responseId,
                participant_id: 'agt_primary',
                request_message_id: 'msg_trigger_s',
                status: 'running',
            });

            const prompts: string[] = [];
            const restore = setHarnessAgentFactoryForTesting(
                fakeAgentFactory(prompts, ['Redundant draft.', 'NO_REPLY'])
            );
            try {
                const result = await createHarnessAgentExecutor().execute(input);

                expect(prompts).toHaveLength(2);
                expect(result.outputMessageIds).toHaveLength(0);
                expect(getResponse(input.responseId)?.summary).toBe('Chose not to reply.');
            } finally {
                restore();
            }
        });
    });
});

function fakeAgentFactory(prompts: string[], replies: string[]) {
    const fakeAgent = {
        createSession: () =>
            Promise.resolve({
                destroy: () => Promise.resolve(),
                sessionId: 'ses_fake',
                stop: () => Promise.resolve({}),
            }),
        stream: (options: { prompt: string }) => {
            prompts.push(options.prompt);
            const reply = replies[Math.min(prompts.length, replies.length) - 1] ?? '';
            return Promise.resolve({
                fullStream: textSegment(`txt_${prompts.length}`, reply),
                text: Promise.resolve(''),
            });
        },
    };
    return (() => fakeAgent) as unknown as Parameters<typeof setHarnessAgentFactoryForTesting>[0];
}

function* textSegment(id: string, text: string) {
    yield { id, type: 'text-start' };
    yield { id, text, type: 'text-delta' };
    yield { id, type: 'text-end' };
}

function seedChat(chatId: string, kind: 'channel' | 'dm') {
    upsertStoredAgent({
        agent: {
            enabledSkillIds: [],
            id: 'agt_primary',
            isAdmin: true,
            name: 'Tavern',
            primaryColor: null,
            workspaceFolder: '/tmp/agt_primary',
        },
    });
    createChat({
        id: chatId,
        kind,
        participants: [
            { id: 'usr_alice', kind: 'user', label: 'Alice', metadata: {} },
            ...(kind === 'channel'
                ? [{ id: 'usr_bob', kind: 'user' as const, label: 'Bob', metadata: {} }]
                : []),
            {
                id: 'agt_primary',
                kind: 'agent',
                label: 'Tavern',
                metadata: { agentId: 'agt_primary' },
            },
        ],
        title: chatId,
    });
}

function seedMessage(
    chatId: string,
    id: string,
    authorId: string,
    content: string,
    options: { role?: 'assistant' | 'user' } = {}
) {
    createMessage(chatId, {
        author_id: authorId,
        content,
        id,
        role: options.role ?? 'user',
    });
    const message = getMessage(id);
    if (!message) {
        throw new Error('seed message missing');
    }
    return message;
}

function seedRunningTurn(chatId: string, triggerMessageId: string) {
    upsertResponse(chatId, {
        id: 'rsp_run_1',
        participant_id: 'agt_primary',
        request_message_id: triggerMessageId,
        status: 'running',
    });
    const session = ensureCurrentAgentSession({
        agentParticipantId: 'agt_primary',
        chatId,
    });
    createAgentTurn({
        agentId: 'agt_primary',
        agentParticipantId: session.agentParticipantId,
        agentSessionId: session.id,
        chatId,
        id: 'run_1',
        responseId: 'rsp_run_1',
        triggerMessageId,
    });
    claimNextAgentTurnForSeat({
        agentParticipantId: session.agentParticipantId,
        agentSessionId: session.id,
        chatId,
    });
}

function gateInput(chatId: string, requestMessageId: string) {
    return executorInput(chatId, requestMessageId);
}

function executorInput(chatId: string, requestMessageId: string) {
    return {
        agent: {
            enabledSkillIds: [],
            id: 'agt_primary',
            isAdmin: true,
            name: 'Tavern',
            primaryColor: null,
            workspaceFolder: mkdtempSync(path.join(os.tmpdir(), 'tavern-gate-test-')),
        } satisfies AgentRuntimeAgent,
        agentSession: {
            agentId: 'agt_primary',
            agentParticipantId: 'agt_primary',
            archivedAt: null,
            chatId,
            createdAt: now,
            effectiveModel: { model: 'gpt-4.1-mini', provider: 'openai' as const },
            generation: 1,
            id: `ags_${chatId}_agt_primary_1`,
            promptContextSequence: 0,
            resumeState: null,
            runtimeSessionId: null,
            status: 'active' as const,
            updatedAt: now,
        } satisfies AgentRuntimeAgentSession,
        attachments: [],
        chatId,
        content: 'question?',
        requestMessageId,
        responseId: 'rsp_run_1',
        runId: 'run_1',
    };
}
