import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import type { AgentExecutorInput } from './agent-executor.ts';
import { ensureCurrentAgentSession } from './agent-session-store.ts';
import { type AgentTurn, createAgentTurn } from './agent-turn-store.ts';
import { upsertStoredAgent } from './agents-store.ts';
import { createChat, createMessage, upsertResponse } from './chat-api/index.ts';
import { harnessPrompt } from './harness-prompt.ts';
import { consumeAgentTurnOutcomeNotes, recordAgentTurnOutcomeNote } from './turn-outcome-notes.ts';

describe('agent turn outcome notes', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
        seedChats();
    });

    afterEach(() => {
        closeDb();
    });

    it('records nothing for turns without dispatch metadata', () => {
        const turn = seedSettledTurn({ metadata: {}, outputMessageIds: ['msg_reply'] });

        expect(recordAgentTurnOutcomeNote(turn, { status: 'completed' })).toBeNull();
        expect(pendingNotesForOtto()).toEqual([]);
    });

    it('maps settle results to outcome statuses and delivers once', () => {
        const turn = seedSettledTurn({
            metadata: { dispatchedBy: dispatchedByOtto() },
            outputMessageIds: ['msg_reply'],
        });

        recordAgentTurnOutcomeNote(turn, { status: 'completed' });
        // Idempotent: a second settle path records nothing new.
        recordAgentTurnOutcomeNote(turn, { status: 'completed' });

        const notes = pendingNotesForOtto();
        expect(notes).toHaveLength(1);
        expect(notes[0]).toMatchObject({
            recipientAgentId: 'agt_otto',
            recipientChatId: 'cht_home',
            replyMessageId: 'msg_reply',
            status: 'completed',
            targetAgentId: 'agt_wren',
            targetChatId: 'cht_target',
            turnId: turn.id,
        });
        expect(pendingNotesForOtto()).toEqual([]);
    });

    it('maps silent, failed, and stopped turns', () => {
        const silent = seedSettledTurn({
            metadata: { dispatchedBy: dispatchedByOtto() },
            outputMessageIds: [],
            suffix: 'silent',
        });
        const failed = seedSettledTurn({
            metadata: { dispatchedBy: dispatchedByOtto() },
            outputMessageIds: [],
            suffix: 'failed',
        });
        const stopped = seedSettledTurn({
            metadata: { dispatchedBy: dispatchedByOtto() },
            outputMessageIds: [],
            suffix: 'stopped',
        });

        recordAgentTurnOutcomeNote(silent, { status: 'completed' });
        recordAgentTurnOutcomeNote(failed, { error: 'Model exploded.', status: 'failed' });
        recordAgentTurnOutcomeNote(stopped, { status: 'cancelled' });

        const outcomes = pendingNotesForOtto().map((note) => [note.status, note.error]);
        expect(outcomes).toHaveLength(3);
        expect(outcomes).toEqual(
            expect.arrayContaining([
                ['no_reply', null],
                ['failed', 'Model exploded.'],
                ['stopped', null],
            ])
        );
    });

    it('harnessPrompt delivers pending notes once and marks them consumed', () => {
        const turn = seedSettledTurn({
            metadata: { dispatchedBy: dispatchedByOtto() },
            outputMessageIds: ['msg_reply'],
        });
        recordAgentTurnOutcomeNote(turn, { status: 'completed' });

        const prompt = harnessPrompt(ottoExecutorInput());
        expect(prompt).toContain('Outcomes of turns your messages dispatched:');
        expect(prompt).toContain('Wren\'s turn in "Target" completed — reply message msg_reply.');

        const second = harnessPrompt(ottoExecutorInput());
        expect(second).not.toContain('Outcomes of turns your messages dispatched:');
    });
});

function dispatchedByOtto() {
    return { agentId: 'agt_otto', chatId: 'cht_home', runId: 'run_otto_origin' };
}

function pendingNotesForOtto() {
    return consumeAgentTurnOutcomeNotes({
        agentId: 'agt_otto',
        chatId: 'cht_home',
        runId: 'run_otto_next',
    });
}

// A settled Wren turn in cht_target with real rows behind every foreign key.
function seedSettledTurn(input: {
    metadata: Record<string, unknown>;
    outputMessageIds: string[];
    suffix?: string;
}): AgentTurn {
    const suffix = input.suffix ?? 'main';
    const messageId = `msg_trigger_${suffix}`;
    const responseId = `rsp_wren_${suffix}`;
    const runId = `run_wren_${suffix}`;
    createMessage('cht_target', {
        author_id: 'usr_tavern',
        content: 'Do the thing.',
        id: messageId,
        role: 'user',
    });
    upsertResponse('cht_target', {
        id: responseId,
        participant_id: 'agt_wren',
        request_message_id: messageId,
        status: 'completed',
    });
    const session = ensureCurrentAgentSession({ agentId: 'agt_wren' });
    const turn = createAgentTurn({
        agentId: 'agt_wren',
        agentParticipantId: 'agt_wren',
        agentSessionId: session.id,
        chatId: 'cht_target',
        id: runId,
        metadata: input.metadata,
        responseId,
        triggerMessageId: messageId,
    });
    return { ...turn, outputMessageIds: input.outputMessageIds };
}

function seedChats() {
    for (const [agentId, name] of [
        ['agt_otto', 'Otto'],
        ['agt_wren', 'Wren'],
    ] as const) {
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: agentId,
                isAdmin: false,
                name,
                primaryColor: null,
                workspaceFolder: `/tmp/${agentId}`,
            },
        });
    }
    const user = { id: 'usr_tavern', kind: 'user' as const, label: 'You', metadata: {} };
    createChat({
        id: 'cht_home',
        kind: 'channel',
        participants: [
            user,
            { id: 'agt_otto', kind: 'agent', label: 'Otto', metadata: { agentId: 'agt_otto' } },
        ],
        title: 'Home',
    });
    createChat({
        id: 'cht_target',
        kind: 'channel',
        participants: [
            user,
            { id: 'agt_wren', kind: 'agent', label: 'Wren', metadata: { agentId: 'agt_wren' } },
        ],
        title: 'Target',
    });
}

let sequence = 0;

function ottoExecutorInput(): AgentExecutorInput {
    const now = new Date().toISOString();
    sequence += 1;
    createMessage('cht_home', {
        author_id: 'usr_tavern',
        content: 'Status?',
        id: `msg_otto_${sequence}`,
        role: 'user',
    });
    return {
        agent: {
            enabledSkillIds: [],
            id: 'agt_otto',
            isAdmin: false,
            name: 'Otto',
            primaryColor: null,
            workspaceFolder: '/tmp/agt_otto',
        },
        agentParticipantId: 'agt_otto',
        agentSession: {
            agentId: 'agt_otto',
            archivedAt: null,
            createdAt: now,
            effectiveModel: { model: 'gpt-4.1-mini', provider: 'openai' },
            generation: 1,
            id: 'ags_cht_home_agt_otto_1',
            lastTurnAt: null,
            resumeState: null,
            runtimeSessionId: 'existing-session',
            status: 'active',
            updatedAt: now,
        },
        attachments: [],
        chatId: 'cht_home',
        content: 'Status?',
        requestMessageId: `msg_otto_${sequence}`,
        responseId: 'rsp_otto',
        runId: `run_otto_${sequence}`,
    };
}
