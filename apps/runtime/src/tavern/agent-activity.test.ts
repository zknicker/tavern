import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { listAgentActivity } from './agent-activity.ts';
import { resetAgentSession } from './agent-session-reset.ts';
import { ensureCurrentAgentSession } from './agent-session-store.ts';
import {
    cancelAgentTurn,
    completeAgentTurn,
    createAgentTurn,
    failAgentTurn,
} from './agent-turn-store.ts';
import { upsertStoredAgent } from './agents-store.ts';
import { createChat, createMessage, upsertResponse } from './chat-api/index.ts';

describe('agent activity feed', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: 'agt_otto',
                isAdmin: false,
                name: 'Otto',
                primaryColor: null,
                workspaceFolder: '/tmp/agt_otto',
            },
        });
        createChat({
            id: 'cht_room',
            kind: 'channel',
            participants: [
                { id: 'usr_tavern', kind: 'user', label: 'You', metadata: {} },
                { id: 'agt_otto', kind: 'agent', label: 'Otto', metadata: { agentId: 'agt_otto' } },
            ],
            title: 'launch-prep',
        });
    });

    afterEach(() => {
        closeDb();
    });

    it('projects arrivals and outcomes per the entry catalog', () => {
        seedTurn('run_1', { content: 'plan the launch' });
        settle('run_1', 'completed');
        seedTurn('run_2', { content: 'fyi only' });
        settle('run_2', 'completed', { summary: 'Chose not to reply.' });
        seedTurn('run_3', { content: 'crash' });
        settle('run_3', 'failed');
        seedTurn('run_4', { metadata: { tavern: { cronJobId: 'cron_missing', source: 'cron' } } });
        seedTurn('run_5', {
            metadata: { tavern: { source: 'task-dispatch', taskId: 'tsk_missing' } },
        });

        const entries = listAgentActivity({ agentId: 'agt_otto' });
        const byKind = (kind: string) => entries.filter((entry) => entry.kind === kind);

        // Arrival entries carry place + sender; running turns have no outcome.
        expect(byKind('message_received')).toHaveLength(3);
        expect(byKind('message_received')[2]).toMatchObject({
            chatId: 'cht_room',
            chatTitle: 'launch-prep',
            detail: 'You',
            turnId: 'run_1',
        });
        expect(byKind('replied')).toHaveLength(1);
        expect(byKind('declined')).toHaveLength(1);
        expect(byKind('failed')).toHaveLength(1);
        expect(byKind('automation_fired')).toHaveLength(1);
        expect(byKind('task_dispatched')).toHaveLength(1);

        // Newest first.
        const stamps = entries.map((entry) => entry.at);
        expect(stamps).toEqual([...stamps].sort().reverse());
    });

    it('projects manual resets as new_session entries with a reason', async () => {
        ensureCurrentAgentSession({ agentId: 'agt_otto' });
        await resetAgentSession({ agentId: 'agt_otto' });
        await resetAgentSession({ agentId: 'agt_otto', kind: 'full' });

        const entries = listAgentActivity({ agentId: 'agt_otto' });
        expect(entries.map((entry) => [entry.kind, entry.detail])).toEqual([
            ['new_session', 'full reset'],
            ['new_session', 'manual reset'],
        ]);
    });

    function seedTurn(
        runId: string,
        input: { content?: string; metadata?: Record<string, unknown> }
    ) {
        createMessage('cht_room', {
            author_id: 'usr_tavern',
            content: input.content ?? 'work',
            id: `msg_${runId}`,
            ...(input.metadata ? { metadata: input.metadata } : {}),
            role: 'user',
        });
        upsertResponse('cht_room', {
            id: `rsp_${runId}`,
            participant_id: 'agt_otto',
            request_message_id: `msg_${runId}`,
            status: 'queued',
        });
        const session = ensureCurrentAgentSession({ agentId: 'agt_otto' });
        createAgentTurn({
            agentId: 'agt_otto',
            agentParticipantId: 'agt_otto',
            agentSessionId: session.id,
            chatId: 'cht_room',
            id: runId,
            responseId: `rsp_${runId}`,
            triggerMessageId: `msg_${runId}`,
        });
    }

    function settle(
        runId: string,
        status: 'cancelled' | 'completed' | 'failed',
        response?: { summary: string }
    ) {
        if (status === 'completed') {
            completeAgentTurn({ activityIds: [], id: runId, outputMessageIds: [] }, getDb());
        } else if (status === 'failed') {
            failAgentTurn({ error: 'boom', id: runId }, getDb());
        } else {
            cancelAgentTurn({ id: runId }, getDb());
        }
        if (response) {
            upsertResponse('cht_room', {
                id: `rsp_${runId}`,
                participant_id: 'agt_otto',
                status: 'completed',
                summary: response.summary,
            });
        }
    }
});
