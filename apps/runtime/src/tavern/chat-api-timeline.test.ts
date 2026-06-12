import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import {
    createChat,
    createMessage,
    getChatTimelinePage,
    upsertArtifact,
    upsertResponse,
    upsertResponseActivity,
} from './chat-api';

describe('Tavern Runtime chat timeline pages', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    it('returns the latest window with anchored responses, activity, and artifacts', () => {
        seedTurn({ index: 1 });
        seedTurn({ activityCount: 2, index: 2 });

        const page = getChatTimelinePage('cht_1', { limit: 10 });

        expect(page.messages.map((message) => message.id)).toEqual([
            'msg_req_1',
            'msg_rsp_1',
            'msg_req_2',
            'msg_rsp_2',
        ]);
        expect(page.responses.map((response) => response.id)).toEqual(['rsp_1', 'rsp_2']);
        expect(page.activity.map((activity) => activity.id)).toEqual([
            'act_1_1',
            'act_2_1',
            'act_2_2',
        ]);
        expect(page.artifacts.map((artifact) => artifact.id)).toEqual(['art_1', 'art_2']);
        expect(page.next_before_sequence).toBeNull();
        expect(page.total_messages).toBe(4);
    });

    it('pages backward by message sequence with stable cursors', () => {
        for (let index = 1; index <= 4; index += 1) {
            seedTurn({ index });
        }

        const latest = getChatTimelinePage('cht_1', { limit: 4 });

        expect(latest.messages.map((message) => message.id)).toEqual([
            'msg_req_3',
            'msg_rsp_3',
            'msg_req_4',
            'msg_rsp_4',
        ]);
        expect(latest.responses.map((response) => response.id)).toEqual(['rsp_3', 'rsp_4']);
        expect(latest.next_before_sequence).toBe(5);

        const older = getChatTimelinePage('cht_1', {
            beforeSequence: latest.next_before_sequence ?? undefined,
            limit: 4,
        });

        expect(older.messages.map((message) => message.id)).toEqual([
            'msg_req_1',
            'msg_rsp_1',
            'msg_req_2',
            'msg_rsp_2',
        ]);
        expect(older.responses.map((response) => response.id)).toEqual(['rsp_1', 'rsp_2']);
        expect(older.next_before_sequence).toBeNull();

        // Appending newer turns must not move an existing cursor's window.
        seedTurn({ index: 5 });
        const replayed = getChatTimelinePage('cht_1', { beforeSequence: 5, limit: 4 });

        expect(replayed.messages.map((message) => message.id)).toEqual(
            older.messages.map((message) => message.id)
        );
    });

    it('extends a window downward so a reply never ships without its request', () => {
        seedTurn({ index: 1 });
        seedTurn({ index: 2 });

        // Window of 1 would start at the reply of turn 2; the page must pull
        // the request message in and anchor the full turn.
        const page = getChatTimelinePage('cht_1', { limit: 1 });

        expect(page.messages.map((message) => message.id)).toEqual(['msg_req_2', 'msg_rsp_2']);
        expect(page.responses.map((response) => response.id)).toEqual(['rsp_2']);
        expect(page.activity.map((activity) => activity.id)).toEqual(['act_2_1']);
        expect(page.next_before_sequence).toBe(3);
    });

    it('anchors a boundary-straddling turn to both pages', () => {
        seedTurn({ index: 1 });
        seedTurn({ index: 2 });

        // beforeSequence 4 cuts between turn 2's request (3) and reply (4):
        // the older page carries the request, and the turn anchors there too.
        const older = getChatTimelinePage('cht_1', { beforeSequence: 4, limit: 10 });

        expect(older.messages.map((message) => message.id)).toEqual([
            'msg_req_1',
            'msg_rsp_1',
            'msg_req_2',
        ]);
        expect(older.responses.map((response) => response.id)).toEqual(['rsp_1', 'rsp_2']);
        expect(older.activity.map((activity) => activity.id)).toEqual(['act_1_1', 'act_2_1']);
    });

    it('keeps unanchored responses on the latest page only', () => {
        seedTurn({ index: 1 });
        seedTurn({ index: 2 });
        upsertResponse('cht_1', {
            id: 'rsp_live',
            participant_id: 'agt_1',
            status: 'running',
        });
        upsertResponseActivity('cht_1', 'rsp_live', {
            id: 'act_live_1',
            kind: 'tool_call',
            status: 'running',
            title: 'Working',
        });

        const latest = getChatTimelinePage('cht_1', { limit: 2 });
        const older = getChatTimelinePage('cht_1', { beforeSequence: 3, limit: 10 });

        expect(latest.responses.map((response) => response.id)).toContain('rsp_live');
        expect(latest.activity.map((activity) => activity.id)).toContain('act_live_1');
        expect(older.responses.map((response) => response.id)).toEqual(['rsp_1']);
    });

    it('returns an empty page for a chat with no messages', () => {
        createChat({ id: 'cht_1' });

        const page = getChatTimelinePage('cht_1');

        expect(page.messages).toEqual([]);
        expect(page.responses).toEqual([]);
        expect(page.next_before_sequence).toBeNull();
        expect(page.total_messages).toBe(0);
    });

    it('rejects unknown chats instead of fabricating a page', () => {
        expect(() => getChatTimelinePage('cht_missing')).toThrow('does not exist');
    });
});

// One full turn: user request message, response with activity and an
// artifact, assistant reply message. Sequences advance two per turn.
function seedTurn({ activityCount = 1, index }: { activityCount?: number; index: number }) {
    if (index === 1) {
        createChat({ id: 'cht_1' });
    }

    createMessage('cht_1', {
        author_id: 'usr_1',
        content: `request ${index}`,
        id: `msg_req_${index}`,
        role: 'user',
    });
    createMessage('cht_1', {
        author_id: 'agt_1',
        content: `reply ${index}`,
        id: `msg_rsp_${index}`,
        role: 'assistant',
    });
    upsertResponse('cht_1', {
        id: `rsp_${index}`,
        participant_id: 'agt_1',
        request_message_id: `msg_req_${index}`,
        response_message_id: `msg_rsp_${index}`,
        status: 'completed',
    });

    for (let step = 1; step <= activityCount; step += 1) {
        upsertResponseActivity('cht_1', `rsp_${index}`, {
            id: `act_${index}_${step}`,
            kind: 'tool_call',
            status: 'completed',
            title: `Tool ${index}.${step}`,
        });
    }

    upsertArtifact('cht_1', {
        id: `art_${index}`,
        kind: 'document',
        response_id: `rsp_${index}`,
        title: `Artifact ${index}`,
    });
}
