import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import type { AgentExecutorInput } from './agent-executor.ts';
import { ensureCurrentAgentSession } from './agent-session-store.ts';
import { listAgentTurnsForSession } from './agent-turn-store.ts';
import { setAgentExecutorForTesting, wakeAgent } from './agent-turn-runner.ts';
import { upsertStoredAgent } from './agents-store.ts';
import { createAgentParticipantId, createMessageId } from './chat-api/ids.ts';
import { createChat, createMessage } from './chat-api/index.ts';
import { planMessageDelivery } from './delivery-planner.ts';
import { readInboxCursor } from './inbox-cursors.ts';

const agentId = 'agt_runner';

describe('floating turn runner (I1)', () => {
    const executed: AgentExecutorInput[] = [];
    let failDrains = false;
    let restoreExecutor: (() => void) | undefined;

    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
        executed.length = 0;
        failDrains = false;
        restoreExecutor = setAgentExecutorForTesting({
            execute: (input) => {
                executed.push(input);
                if (failDrains && input.prompt.startsWith('New message')) {
                    return Promise.reject(new Error('boom'));
                }
                return Promise.resolve({ contextTokens: 123 });
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

    function send(content: string) {
        return createMessage('cht_run', {
            author_id: 'usr_tavern',
            content,
            id: createMessageId(),
            role: 'user',
        }).message;
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
