import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { createChat, getResponse, upsertResponse } from './chat-api';
import { recoverInterruptedChatResponses } from './turn-recovery';

describe('turn recovery', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    test('finalizes responses orphaned in a non-terminal state', () => {
        createChat({ id: 'cht_1', title: 'Recovery' });
        upsertResponse('cht_1', {
            id: 'rsp_stuck',
            metadata: { runtime: { runId: 'run_1', source: 'hermes' } },
            participant_id: 'agt_demo',
            status: 'running',
        });
        upsertResponse('cht_1', {
            id: 'rsp_done',
            participant_id: 'agt_demo',
            status: 'completed',
        });

        const recovered = recoverInterruptedChatResponses();

        expect(recovered).toBe(1);
        const stuck = getResponse('rsp_stuck');
        expect(stuck).toMatchObject({
            status: 'failed',
            summary: 'Interrupted by an agent runtime restart.',
        });
        expect(stuck?.completed_at).toBeTruthy();
        expect(stuck?.metadata).toMatchObject({
            error: 'Interrupted by an agent runtime restart.',
            runtime: {
                errorCode: 'control_plane_restarted',
                runId: 'run_1',
                source: 'hermes',
            },
        });
        expect(getResponse('rsp_done')?.status).toBe('completed');
    });

    test('is a no-op when every response is terminal', () => {
        createChat({ id: 'cht_1', title: 'Recovery' });
        upsertResponse('cht_1', {
            id: 'rsp_done',
            participant_id: 'agt_demo',
            status: 'completed',
        });

        expect(recoverInterruptedChatResponses(getDb())).toBe(0);
    });
});
