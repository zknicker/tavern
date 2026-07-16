import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { createChat, createMessage, upsertResponse, upsertResponseActivity } from './chat-api';
import { listProjectedTavernRuntimeEvents } from './runtime-event-projection';

const runtimeMetadata = {
    runtime: {
        agentId: 'agt_1',
        agentSessionId: 'ags_1',
        runId: 'run_1_agent',
    },
};

describe('Tavern runtime event projection', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
        createChat({ id: 'cht_1' });
    });

    afterEach(() => {
        closeDb();
    });

    it('marks a delivered completion as having a reply', () => {
        createMessage('cht_1', {
            author_id: 'agt_1',
            content: 'done',
            id: 'msg_reply_1',
            role: 'assistant',
        });
        upsertResponse('cht_1', {
            id: 'rsp_1',
            metadata: runtimeMetadata,
            participant_id: 'agt_1',
            response_message_id: 'msg_reply_1',
            status: 'completed',
        });

        const completed = listProjectedTavernRuntimeEvents({})
            .map((entry) => entry.event)
            .filter((event) => event.type === 'turn.completed');

        expect(completed).toHaveLength(1);
        expect(completed[0]).toMatchObject({
            hasReply: true,
            turn: { runId: 'run_1_agent' },
        });
    });

    it('marks a silent completion as replyless so clients drop the live reply', () => {
        upsertResponse('cht_1', {
            id: 'rsp_1',
            metadata: runtimeMetadata,
            participant_id: 'agt_1',
            status: 'completed',
            summary: 'Chose not to reply.',
        });

        const completed = listProjectedTavernRuntimeEvents({})
            .map((entry) => entry.event)
            .filter((event) => event.type === 'turn.completed');

        expect(completed).toHaveLength(1);
        expect(completed[0]).toMatchObject({
            hasReply: false,
            turn: { runId: 'run_1_agent' },
        });
    });

    it('keeps status notices out of the live step stream, evidence only', () => {
        upsertResponse('cht_1', {
            id: 'rsp_1',
            metadata: runtimeMetadata,
            participant_id: 'agt_1',
            status: 'running',
        });
        upsertResponseActivity('cht_1', 'rsp_1', {
            detail: 'Reply held for freshness review: 1 new message landed during the turn.',
            id: 'act_hold_1',
            kind: 'custom',
            metadata: {
                runtime: {
                    ...runtimeMetadata.runtime,
                    notice: { id: 'runtime_notice_freshness_hold', kind: 'status', text: 'held' },
                },
            },
            status: 'completed',
            title: 'Reply held for freshness review',
        });

        const steps = listProjectedTavernRuntimeEvents({})
            .map((entry) => entry.event)
            .filter((event) => event.type === 'turn.progress');
        expect(steps).toHaveLength(0);
    });

    it('keeps new-session notices flowing as live notice steps', () => {
        upsertResponse('cht_1', {
            id: 'rsp_1',
            metadata: runtimeMetadata,
            participant_id: 'agt_1',
            status: 'completed',
        });
        upsertResponseActivity('cht_1', 'rsp_1', {
            detail: 'Started a fresh session.',
            id: 'act_new_session_1',
            kind: 'custom',
            metadata: {
                runtime: {
                    ...runtimeMetadata.runtime,
                    notice: {
                        id: 'runtime_notice_session_reset',
                        kind: 'new_session',
                        text: 'New session',
                    },
                },
            },
            status: 'completed',
            title: 'New session',
        });

        const steps = listProjectedTavernRuntimeEvents({})
            .map((entry) => entry.event)
            .filter((event) => event.type === 'turn.progress');
        expect(steps.map((step) => ('step' in step ? step.step.kind : null))).toEqual(['notice']);
    });
});
