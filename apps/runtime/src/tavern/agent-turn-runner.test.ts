import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { muteAgentChannel } from './agent-channels.ts';
import type { AgentExecutorInput } from './agent-executor.ts';
import { checkAgentMessages } from './agent-inbox-api.ts';
import { ensureCurrentAgentSession, startNewAgentSession } from './agent-session-store.ts';
import {
    setAgentExecutorForTesting,
    stopAgentTurns,
    wakeAgent,
} from './agent-turn-runner.ts';
import {
    createAgentTurn,
    hasUnsettledAgentTurnsForAgent,
    listAgentTurnsForSession,
} from './agent-turn-store.ts';
import { upsertStoredAgent } from './agents-store.ts';
import { createAgentParticipantId, createMessageId } from './chat-api/ids.ts';
import { createChat, createMessage } from './chat-api/index.ts';
import { planMessageDelivery } from './delivery-planner.ts';
import { listInboxPierces, readInboxCursor } from './inbox-cursors.ts';
import { subscribeToRuntimeEvents } from './runtime-events.ts';

const agentId = 'agt_runner';

describe('floating turn runner (I1)', () => {
    const executed: AgentExecutorInput[] = [];
    const stoppedRunIds: string[] = [];
    let blockNextDrain = false;
    let failDrains = false;
    let pullDuringDrain = false;
    let releaseBlockedDrain: (() => void) | undefined;
    let restoreExecutor: (() => void) | undefined;

    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
        executed.length = 0;
        stoppedRunIds.length = 0;
        blockNextDrain = false;
        failDrains = false;
        pullDuringDrain = false;
        releaseBlockedDrain = undefined;
        restoreExecutor = setAgentExecutorForTesting({
            execute: (input) => {
                executed.push(input);
                const isDrain = input.prompt.startsWith('New message');
                if (pullDuringDrain && isDrain) {
                    checkAgentMessages(agentId);
                }
                if (blockNextDrain && isDrain) {
                    blockNextDrain = false;
                    return new Promise((resolve) => {
                        releaseBlockedDrain = () => resolve({ contextTokens: 123 });
                    });
                }
                if (failDrains && isDrain) {
                    return Promise.reject(new Error('boom'));
                }
                return Promise.resolve({ contextTokens: 123 });
            },
            stop: (runId) => {
                stoppedRunIds.push(runId);
                releaseBlockedDrain?.();
                return true;
            },
        });
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: agentId,
                isAdmin: false,
                name: 'Runner',
                primaryColor: null,
                workspaceFolder: '/tmp/agt_runner',
            },
        });
        createChat({
            id: 'cht_run',
            kind: 'channel',
            participants: [
                { id: 'usr_tavern', kind: 'user', label: 'zach', metadata: {} },
                {
                    id: createAgentParticipantId(agentId),
                    kind: 'agent',
                    label: 'Runner',
                    metadata: { agentId },
                },
            ],
            title: 'run',
        });
    });

    afterEach(() => {
        restoreExecutor?.();
        closeDb();
    });

    it('runs Start. first on a fresh session, then one batched drain', async () => {
        const first = send('hello');
        const second = send('again');
        planMessageDelivery('cht_run', first);
        planMessageDelivery('cht_run', second);
        wakeAgent(agentId);

        const session = ensureCurrentAgentSession({ agentId });
        await settled(session.id, 2);
        const turns = listAgentTurnsForSession(session.id);
        expect(turns[0]?.kind).toBe('start');
        expect(turns[0]?.status).toBe('completed');
        expect(executed[0]?.prompt).toBe('Start.');
        const drainPrompt = executed[1]?.prompt ?? '';
        expect(drainPrompt.startsWith('New messages received:')).toBe(true);
        expect(drainPrompt).toContain('hello');
        expect(drainPrompt).toContain('again');
        // Embedded envelopes advanced `seen` at settle (I3).
        expect(readInboxCursor(session.id, 'cht_run').seenUpToSeq).toBe(second.sequence);
    });

    it('leaves cursors untouched when the drain fails, so catch-up re-delivers', async () => {
        failDrains = true;
        const message = send('will fail');
        planMessageDelivery('cht_run', message);
        const session = ensureCurrentAgentSession({ agentId });
        wakeAgent(agentId);
        await settled(session.id, 2);

        const turns = listAgentTurnsForSession(session.id);
        expect(turns.some((turn) => turn.kind === 'drain' && turn.status === 'failed')).toBe(true);
        // No proof, no advancement (I3): the failed drain's envelopes were
        // never provably seen, so the pending rows re-deliver from `seen`.
        expect(readInboxCursor(session.id, 'cht_run').seenUpToSeq).toBe(0);
        expect(readInboxCursor(session.id, 'cht_run').deliveredUpToSeq).toBe(message.sequence);
    });

    it('cancels queued work before the running turn without starting a replacement', async () => {
        const session = await bootIdleSession();
        blockNextDrain = true;
        const message = send('block this drain');
        planMessageDelivery('cht_run', message);
        wakeAgent(agentId);
        await waitFor(() => executed.some((input) => input.prompt.includes('block this drain')));
        const running = listAgentTurnsForSession(session.id).find(
            (turn) => turn.status === 'running'
        );
        createAgentTurn({
            agentId,
            agentSessionId: session.id,
            id: 'run_queued_after_running',
            kind: 'drain',
        });

        await stopAgentTurns(agentId);
        await settled(session.id, 4);

        const turns = listAgentTurnsForSession(session.id);
        expect(running?.status).toBe('running');
        expect(turns.find((turn) => turn.id === running?.id)?.status).toBe('cancelled');
        expect(turns.find((turn) => turn.id === 'run_queued_after_running')?.status).toBe(
            'cancelled'
        );
        expect(stoppedRunIds).toEqual([running?.id]);
        expect(executed.filter((input) => input.prompt.includes('block this drain'))).toHaveLength(
            1
        );
    });

    it('rechecks the current session for pending work after a turn settles', async () => {
        const original = await bootIdleSession();
        blockNextDrain = true;
        const oldMessage = send('old session work');
        planMessageDelivery('cht_run', oldMessage);
        wakeAgent(agentId);
        await waitFor(() => executed.some((input) => input.prompt.includes('old session work')));

        const current = startNewAgentSession({ agentId });
        const freshMessage = send('fresh session work');
        planMessageDelivery('cht_run', freshMessage);
        releaseBlockedDrain?.();

        await settled(current.id, 2);
        expect(original.id).not.toBe(current.id);
        expect(executed.some((input) => input.prompt.includes('fresh session work'))).toBe(true);
        expect(readInboxCursor(current.id, 'cht_run').seenUpToSeq).toBe(freshMessage.sequence);
    });

    it('publishes presence updates when a turn is claimed and settled', async () => {
        const presence: boolean[] = [];
        const unsubscribe = subscribeToRuntimeEvents((event) => {
            if (event.type === 'agent.updated' && event.agentId === agentId) {
                presence.push(hasUnsettledAgentTurnsForAgent(agentId));
            }
        });
        const message = send('presence work');
        planMessageDelivery('cht_run', message);

        wakeAgent(agentId);
        const session = ensureCurrentAgentSession({ agentId });
        await settled(session.id, 2);
        unsubscribe();

        expect(presence).toContain(true);
        expect(presence.at(-1)).toBe(false);
    });

    it('restores served pierces after failure and clears them after completion', async () => {
        const session = await bootIdleSession();
        muteAgentChannel(agentId, { target: '#run' });
        pullDuringDrain = true;
        failDrains = true;
        const mention = send('ping @Runner');
        planMessageDelivery('cht_run', mention);

        wakeAgent(agentId);
        await waitFor(() =>
            listAgentTurnsForSession(session.id).some(
                (turn) => turn.kind === 'drain' && turn.status === 'failed'
            )
        );
        expect(listInboxPierces(session.id, { excludeServed: true })).toEqual([
            { chatId: 'cht_run', messageId: mention.id },
        ]);

        failDrains = false;
        wakeAgent(agentId);
        await waitFor(() =>
            listAgentTurnsForSession(session.id).some(
                (turn) => turn.kind === 'drain' && turn.status === 'completed'
            )
        );
        expect(listInboxPierces(session.id)).toEqual([]);
    });

    function send(content: string) {
        return createMessage('cht_run', {
            author_id: 'usr_tavern',
            content,
            id: createMessageId(),
            role: 'user',
        }).message;
    }

    async function bootIdleSession() {
        wakeAgent(agentId);
        const session = ensureCurrentAgentSession({ agentId });
        await settled(session.id, 2);
        return session;
    }

    async function settled(sessionId: string, minTurns: number) {
        await waitFor(() => {
            const turns = listAgentTurnsForSession(sessionId);
            return (
                turns.length >= minTurns &&
                turns.every((turn) => turn.status !== 'queued' && turn.status !== 'running')
            );
        });
    }
});

async function waitFor(check: () => boolean, timeoutMs = 3000) {
    const startedAt = Date.now();
    while (!check()) {
        if (Date.now() - startedAt > timeoutMs) {
            throw new Error('Timed out waiting for condition.');
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
}
