import { runtimeRoutes } from '@tavern/api';
import { developmentChatDemoIds } from '@tavern/api/development-chat-demos';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { namedParams } from '../db/sqlite';
import {
    defaultAgentDmChatId,
    defaultWorkspaceChannelId,
    localHumanParticipantId,
    seedWorkspaceChats,
} from './bootstrap-chats';
import {
    clearChat,
    createChat,
    createDelivery,
    createMessage,
    deleteResponse,
    getChat,
    getResponse,
    getResponseActivity,
    listChats,
    listEvents,
    listMessages,
    listResponses,
    markRead,
    searchMessages,
    subscribeToTavernApiEvents,
    upsertArtifact,
    upsertResponse,
    upsertResponseActivity,
} from './chat-api';
import { insertEvent } from './chat-api/events';
import { seedDevelopmentChatDemos } from './development-chat-demos';
import { handleTavernRuntimeRequest } from './router';
import { listProjectedTavernRuntimeEvents } from './runtime-event-projection';

describe('Tavern Runtime Chat API store', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    it('keeps composer command runs out of the live turn projection', () => {
        createChat({ id: 'cht_1', title: 'Test' });
        upsertResponse('cht_1', {
            id: 'rsp_cmd_1',
            metadata: { runtime: { agentId: 'agt_primary', source: 'command' } },
            participant_id: 'agt_primary',
            status: 'completed',
        });
        upsertResponseActivity('cht_1', 'rsp_cmd_1', {
            detail: 'Agent CLI Status',
            id: 'act_rsp_cmd_1',
            kind: 'command',
            metadata: { command: { status: 'completed', text: '/status' } },
            status: 'completed',
            title: '/status',
        });

        const projected = listProjectedTavernRuntimeEvents().map((entry) => entry.event.type);
        expect(projected).not.toContain('turn.started');
        expect(projected).not.toContain('turn.completed');
        expect(projected).not.toContain('turn.progress');
    });

    it('seeds development chat demos as durable Runtime chats', () => {
        const first = seedDevelopmentChatDemos({ db: getDb(), enabled: true });
        const second = seedDevelopmentChatDemos({ db: getDb(), enabled: true });

        expect(first.seeded).toBe(1);
        expect(second.seeded).toBe(1);
        expect(
            listChats()
                .chats.map((chat) => chat.id)
                .sort()
        ).toEqual([developmentChatDemoIds.demo]);
        expect(getChat(developmentChatDemoIds.demo)).toMatchObject({
            id: developmentChatDemoIds.demo,
            title: 'demo',
        });

        const demoMessages = listMessages(developmentChatDemoIds.demo).messages;
        expect(demoMessages).toHaveLength(37);
        expect(demoMessages.slice(0, -1).map((message) => message.role)).toEqual(
            Array.from({ length: 36 }, (_, index) => (index % 2 === 0 ? 'user' : 'assistant'))
        );
        expect(demoMessages.at(-1)).toMatchObject({
            id: 'msg_demo_streaming_stack_request',
            role: 'user',
        });
        expect(demoMessages.map((message) => message.id).slice(0, 4)).toEqual([
            'msg_demo_charts_request',
            'msg_demo_charts_response',
            'msg_demo_merchbase_sales_chart_request',
            'msg_demo_merchbase_sales_chart_response',
        ]);
        expect(listResponses(developmentChatDemoIds.demo).responses).toHaveLength(19);
        expect(
            listResponses(developmentChatDemoIds.demo).responses.find(
                (response) => response.id === 'rsp_demo_charts'
            )
        ).toMatchObject({
            id: 'rsp_demo_charts',
            request_message_id: 'msg_demo_charts_request',
            response_message_id: 'msg_demo_charts_response',
            status: 'completed',
        });
        expect(getResponseActivity('act_demo_charts_rich_response')).toMatchObject({
            id: 'act_demo_charts_rich_response',
            kind: 'rich_response',
            metadata: {
                richResponse: {
                    props: {
                        spec: {
                            elements: {
                                bar: { type: 'BarChart' },
                                composed: { type: 'ComposedChart' },
                                line: { type: 'LineChart' },
                            },
                        },
                    },
                },
            },
            status: 'completed',
            title: 'Rich Response',
        });
        expect(getResponseActivity('act_demo_calendar_day_rich_response')).toMatchObject({
            id: 'act_demo_calendar_day_rich_response',
            kind: 'rich_response',
            status: 'completed',
            title: 'Rich Response',
        });
        expect(getResponseActivity('act_demo_merchbase_sales_chart')).toMatchObject({
            id: 'act_demo_merchbase_sales_chart',
            kind: 'rich_response',
            metadata: {
                richResponse: {
                    props: {
                        spec: {
                            elements: {
                                chart: { type: 'MerchBaseSalesChart' },
                            },
                        },
                    },
                },
            },
            status: 'completed',
            title: 'Rich Response',
        });
        expect(getResponseActivity('act_demo_calendar_event_rich_response')).toMatchObject({
            id: 'act_demo_calendar_event_rich_response',
            kind: 'rich_response',
            status: 'completed',
            title: 'Rich Response',
        });
        expect(getResponseActivity('act_demo_rich_response_catalog')).toMatchObject({
            id: 'act_demo_rich_response_catalog',
            kind: 'rich_response',
            metadata: {
                richResponse: {
                    props: {
                        spec: {
                            elements: {
                                separator: { type: 'Separator' },
                                table: { type: 'Table' },
                                title: { type: 'Heading' },
                            },
                        },
                    },
                },
            },
            status: 'completed',
            title: 'Rich Response',
        });
        expect(
            listMessages(developmentChatDemoIds.demo).messages.find(
                (message) => message.id === 'msg_demo_attachment_request'
            )?.attachments
        ).toEqual([expect.objectContaining({ filename: 'weather-request.txt', type: 'file' })]);
        expect(getResponseActivity('act_demo_activity_turn_tests')).toMatchObject({
            kind: 'tool_call',
            status: 'completed',
        });
        const demoResponseIds = listResponses(developmentChatDemoIds.demo).responses.map(
            (response) => response.id
        );
        expect(demoResponseIds).toContain('rsp_demo_turn_timeline_08');
        expect(demoResponseIds).not.toContain('rsp_demo_turn_timeline_09');
        expect(listResponses(developmentChatDemoIds.demo).responses).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: 'rsp_demo_streaming_stack', status: 'running' }),
            ])
        );
        expect(getResponseActivity('act_demo_tool_headers_read_sales')).toMatchObject({
            kind: 'tool_call',
            status: 'completed',
            title: 'sales-summary.json',
        });
        expect(getResponseActivity('act_demo_tool_headers_live_command')).toBeNull();
        expect(getResponseActivity('act_demo_streaming_stack_scan')).toMatchObject({
            kind: 'tool_call',
            status: 'completed',
            title: 'bun run scan:hosts',
        });
    });

    it('replaces stale development demo activity when a demo shape changes', () => {
        const db = getDb();
        seedDevelopmentChatDemos({ db, enabled: true });
        db.prepare('DELETE FROM chat_response_activity WHERE response_id = $responseId').run(
            namedParams({ responseId: 'rsp_demo_charts' })
        );
        upsertResponseActivity(developmentChatDemoIds.demo, 'rsp_demo_charts', {
            id: 'act_demo_charts_tool',
            kind: 'tool_call',
            sequence: 1,
            status: 'completed',
            title: 'old chart activity',
        });
        upsertResponseActivity(developmentChatDemoIds.demo, 'rsp_demo_charts', {
            id: 'act_demo_charts_rich_response',
            kind: 'rich_response',
            sequence: 2,
            status: 'completed',
            title: 'Rich Response',
        });

        expect(() => seedDevelopmentChatDemos({ db, enabled: true })).not.toThrow();
        const rows = db
            .prepare(
                `SELECT id, sequence
                 FROM chat_response_activity
                 WHERE response_id = $responseId
                 ORDER BY sequence ASC`
            )
            .all(namedParams({ responseId: 'rsp_demo_charts' })) as {
            id: string;
            sequence: number;
        }[];

        expect(rows.map((row) => row.id)).toEqual(['act_demo_charts_rich_response']);
    });

    it('removes obsolete per-feature development demo chats', () => {
        createChat({
            id: 'cht_demo_charts',
            metadata: {
                tavern: {
                    archived: false,
                    displayName: 'Demo: Charts',
                },
            },
            title: 'Demo: Charts',
        });

        seedDevelopmentChatDemos({ db: getDb(), enabled: true });

        expect(getChat('cht_demo_charts')).toBeNull();
        expect(getChat(developmentChatDemoIds.demo)).toMatchObject({
            id: developmentChatDemoIds.demo,
            title: 'demo',
        });
    });

    it('removes obsolete demo rows before reusing stable ids in the demo channel', () => {
        createChat({
            id: 'cht_demo_charts',
            metadata: {
                tavern: {
                    archived: false,
                    displayName: 'Demo: Charts',
                },
            },
            title: 'Demo: Charts',
        });
        createMessage(
            'cht_demo_charts',
            messageInput('msg_demo_charts_request', 'old-user', 'old')
        );
        createMessage(
            'cht_demo_charts',
            messageInput('msg_demo_charts_response', 'old-agent', 'old response')
        );
        upsertResponse('cht_demo_charts', {
            id: 'rsp_demo_charts',
            participant_id: 'agt_primary',
            request_message_id: 'msg_demo_charts_request',
            response_message_id: 'msg_demo_charts_response',
            status: 'completed',
        });

        expect(() => seedDevelopmentChatDemos({ db: getDb(), enabled: true })).not.toThrow();

        expect(getChat('cht_demo_charts')).toBeNull();
        expect(getResponse('rsp_demo_charts')).toMatchObject({
            chat_id: developmentChatDemoIds.demo,
            request_message_id: 'msg_demo_charts_request',
            response_message_id: 'msg_demo_charts_response',
        });
        expect(
            listMessages(developmentChatDemoIds.demo).messages.map((message) => message.id)
        ).toContain('msg_demo_charts_request');
    });

    it('soft-deletes a response and projects a history change', () => {
        createChat({ id: 'cht_1' });
        upsertResponse('cht_1', {
            id: 'rsp_cmd_1',
            metadata: { runtime: { agentId: 'agt_primary', source: 'command' } },
            participant_id: 'agt_primary',
            status: 'completed',
        });

        const receipt = deleteResponse('rsp_cmd_1');

        expect(receipt.response_id).toBe('rsp_cmd_1');
        expect(getResponse('rsp_cmd_1')?.deleted_at).toBe(receipt.deleted_at);
        expect(listResponses('cht_1').responses[0]?.deleted_at).toBe(receipt.deleted_at);
        expect(listEvents().events.map((event) => event.type)).toContain('response.deleted');
        expect(listProjectedTavernRuntimeEvents().map((entry) => entry.event.type)).toContain(
            'chat.historyChanged'
        );
    });

    it('rejects deleting a response that does not exist', () => {
        createChat({ id: 'cht_1' });

        expect(() => deleteResponse('rsp_missing')).toThrow('Missing chat response');
    });

    it('clears a chat by soft-deleting everything currently in it', () => {
        createChat({ id: 'cht_1' });
        createMessage('cht_1', messageInput('msg_1', 'nonce_1', 'hello'));
        upsertResponse('cht_1', {
            id: 'rsp_1',
            participant_id: 'agt_primary',
            status: 'completed',
        });

        const receipt = clearChat('cht_1');

        expect(receipt.messages_deleted).toBe(1);
        expect(receipt.responses_deleted).toBe(1);
        expect(listMessages('cht_1').messages[0]?.deleted_at).toBe(receipt.cleared_at);
        expect(listResponses('cht_1').responses[0]?.deleted_at).toBe(receipt.cleared_at);
        expect(listEvents().events.map((event) => event.type)).toContain('chat.cleared');

        // Sequence slots stay stable, new work after the clear is visible,
        // and a repeat clear does not re-delete already-hidden rows.
        const after = createMessage('cht_1', messageInput('msg_2', 'nonce_2', 'after'));
        expect(after.message.sequence).toBe(2);
        expect(after.message.deleted_at).toBeNull();

        const repeat = clearChat('cht_1');
        expect(repeat.messages_deleted).toBe(1);
        expect(repeat.responses_deleted).toBe(0);
    });

    it('creates messages with per-chat sequence, events, and idempotent nonce receipts', () => {
        createChat({ id: 'cht_1', title: 'Test' });
        const first = createMessage('cht_1', messageInput('msg_1', 'nonce_1', 'hello'));
        const replay = createMessage('cht_1', messageInput('msg_retry', 'nonce_1', 'hello'));
        const second = createMessage('cht_1', messageInput('msg_2', 'nonce_2', 'again'));

        expect(first.idempotent).toBe(false);
        expect(replay.idempotent).toBe(true);
        expect(replay.message.id).toBe('msg_1');
        expect(first.message.sequence).toBe(1);
        expect(second.message.sequence).toBe(2);
        expect(listEvents().events.map((event) => event.type)).toEqual([
            'message.created',
            'message.created',
        ]);
    });

    it('rejects nonce reuse for a different durable message shape', () => {
        createChat({ id: 'cht_1' });
        createMessage('cht_1', messageInput('msg_1', 'nonce_1', 'hello'));

        expect(() => createMessage('cht_1', messageInput('msg_2', 'nonce_1', 'different'))).toThrow(
            'already used'
        );
    });

    it('rejects malformed Tavern product ids at the write boundary', () => {
        expect(() => createChat({ id: 'chat-1' })).toThrow('Chat id must use a cht_ id.');

        createChat({ id: 'cht_1' });

        expect(() => createMessage('cht_1', messageInput('message-1', 'nonce_1', 'hello'))).toThrow(
            'Message id must use a msg_ id.'
        );
        expect(() =>
            createDelivery('cht_1', {
                agent_id: 'main',
                id: 'delivery-1',
                message: {
                    ...messageInput('msg_1', undefined, 'done'),
                    author_id: 'agt_1',
                    role: 'assistant',
                },
                turn_id: 'turn-1',
            })
        ).toThrow('Delivery id must use a del_ id.');
        expect(() =>
            upsertResponse('cht_1', {
                id: 'response-1',
                participant_id: 'agt_1',
                status: 'running',
            })
        ).toThrow('Response id must use a rsp_ id.');
    });

    it('creates and reads channel and DM chats with participants', () => {
        createChat({
            id: 'cht_channel',
            kind: 'channel',
            participants: [
                { id: 'usr_tavern', kind: 'user', label: 'You', metadata: {} },
                { id: 'agt_primary', kind: 'agent', label: 'Tavern', metadata: {} },
            ],
            title: '#general',
        });
        createChat({
            id: 'cht_dm',
            kind: 'dm',
            participants: [
                { id: 'usr_tavern', kind: 'user', label: 'You', metadata: {} },
                { id: 'agt_primary', kind: 'agent', label: 'Tavern', metadata: {} },
            ],
            title: 'Tavern',
        });

        expect(getChat('cht_channel')).toMatchObject({
            id: 'cht_channel',
            kind: 'channel',
            participants: [
                { id: 'agt_primary', kind: 'agent', label: 'Tavern' },
                { id: 'usr_tavern', kind: 'user', label: 'You' },
            ],
            title: '#general',
        });
        expect(getChat('cht_dm')).toMatchObject({
            id: 'cht_dm',
            kind: 'dm',
            title: 'Tavern',
        });
        expect(() =>
            createChat({
                id: 'cht_bad_dm',
                kind: 'dm',
                participants: [{ id: 'usr_tavern', kind: 'user', label: 'You', metadata: {} }],
            })
        ).toThrow('A DM chat must have exactly two participants.');
    });

    it('bootstraps the default workspace channel and agent DM', () => {
        const first = seedWorkspaceChats({
            agentId: 'agt_primary',
            agentName: 'Tavern',
            db: getDb(),
        });
        const second = seedWorkspaceChats({
            agentId: 'agt_primary',
            agentName: 'Tavern',
            db: getDb(),
        });

        expect(first.seeded).toBe(2);
        expect(second.seeded).toBe(0);
        expect(getChat(defaultWorkspaceChannelId)).toMatchObject({
            id: defaultWorkspaceChannelId,
            kind: 'channel',
            participants: [
                { id: 'agt_primary', kind: 'agent', label: 'Tavern' },
                { id: localHumanParticipantId, kind: 'user', label: 'You' },
            ],
            title: '#general',
        });
        expect(getChat(defaultAgentDmChatId)).toMatchObject({
            id: defaultAgentDmChatId,
            kind: 'dm',
            participants: [
                { id: 'agt_primary', kind: 'agent', label: 'Tavern' },
                { id: localHumanParticipantId, kind: 'user', label: 'You' },
            ],
            title: 'Tavern',
        });
    });

    it('stores pinned chat state as a durable chat field', () => {
        createChat({ id: 'cht_1', pinned: true, title: 'Pinned' });
        createChat({ id: 'cht_1', title: 'Renamed' });

        expect(getChat('cht_1')?.pinned).toBe(true);
        expect(listChats().chats[0]?.pinned).toBe(true);

        getDb()
            .prepare("UPDATE chats SET updated_at = '2026-05-28T22:55:00.000Z' WHERE id = 'cht_1'")
            .run();
        createChat({ id: 'cht_1', pinned: false });

        expect(getChat('cht_1')).toMatchObject({
            pinned: false,
            updated_at: '2026-05-28T22:55:00.000Z',
        });
    });

    it('writes delivery, assistant message, and delivered event in one receipt', () => {
        createChat({ id: 'cht_1' });
        const receipt = createDelivery('cht_1', {
            agent_id: 'agt_1',
            id: 'del_1',
            message: {
                ...messageInput('msg_agt_1', undefined, 'done'),
                author_id: 'agt_1',
                role: 'assistant',
            },
        });

        expect(receipt.message.role).toBe('assistant');
        expect(listMessages('cht_1').messages).toHaveLength(1);
        expect(listEvents().events.at(-1)?.type).toBe('message.delivered');
    });

    it('searches canonical chat messages by content within one chat', () => {
        createChat({ id: 'cht_1' });
        createChat({ id: 'cht_2' });
        createMessage('cht_1', messageInput('msg_1', 'nonce_1', 'podcast note'));
        createMessage('cht_1', messageInput('msg_2', 'nonce_2', 'finance note'));
        createMessage('cht_1', messageInput('msg_3', 'nonce_3', 'Podcast follow-up'));
        createMessage('cht_2', messageInput('msg_4', 'nonce_4', 'podcast in another chat'));

        expect(searchMessages('cht_1', { limit: 10, query: 'podcast' }).messages).toMatchObject([
            { id: 'msg_3', sequence: 3 },
            { id: 'msg_1', sequence: 1 },
        ]);
    });

    it('links repeated assistant delivery receipts to the existing durable message', () => {
        createChat({ id: 'cht_1' });
        const first = createDelivery('cht_1', {
            agent_id: 'agt_1',
            id: 'del_1',
            message: {
                ...messageInput('msg_agt_1', undefined, 'done'),
                author_id: 'agt_1',
                role: 'assistant',
            },
        });
        const replay = createDelivery('cht_1', {
            agent_id: 'agt_1',
            id: 'del_2',
            message: {
                ...messageInput('msg_agt_1', undefined, 'done'),
                author_id: 'agt_1',
                role: 'assistant',
            },
        });

        expect(first.idempotent).toBe(false);
        expect(replay.idempotent).toBe(false);
        expect(replay.message.id).toBe('msg_agt_1');
        expect(replay.message.sequence).toBe(first.message.sequence);
        expect(listMessages('cht_1').messages).toHaveLength(1);
        expect(listEvents().events.map((event) => event.type)).toEqual([
            'message.delivered',
            'message.delivered',
        ]);
    });

    it('stores responses, activity, artifacts, and read state as cursor-backed events', () => {
        createChat({ id: 'cht_1' });
        createMessage('cht_1', messageInput('msg_1', 'nonce_1', 'hello'));
        const { response } = upsertResponse('cht_1', {
            id: 'rsp_1',
            participant_id: 'agt_1',
            request_message_id: 'msg_1',
            status: 'running',
            summary: 'Working',
        });
        const { activity } = upsertResponseActivity('cht_1', 'rsp_1', {
            id: 'act_1',
            kind: 'tool_call',
            status: 'running',
            title: 'Using tool',
        });
        const { artifact } = upsertArtifact('cht_1', {
            activity_id: 'act_1',
            id: 'art_1',
            kind: 'text',
            response_id: 'rsp_1',
            title: 'Tool output',
        });
        const read = markRead('cht_1', {
            last_read_sequence: 1,
            reader_id: 'usr_1',
        });

        expect(response.summary).toBe('Working');
        expect(activity.title).toBe('Using tool');
        expect(artifact.title).toBe('Tool output');
        expect(read.last_read_sequence).toBe(1);
        expect(listResponses('cht_1').responses).toHaveLength(1);
        expect(listEvents().events.map((event) => event.type)).toEqual([
            'message.created',
            'response.created',
            'activity.created',
            'artifact.created',
        ]);
        expect(listEvents({ recipientId: 'usr_1' }).events.map((event) => event.type)).toEqual([
            'message.created',
            'response.created',
            'activity.created',
            'artifact.created',
            'chat.read',
        ]);
        expect(listEvents({ recipientId: 'usr_2' }).events.map((event) => event.type)).toEqual([
            'message.created',
            'response.created',
            'activity.created',
            'artifact.created',
        ]);
    });

    it('stores terminal response activity in place', () => {
        createChat({ id: 'cht_1' });
        upsertResponse('cht_1', {
            id: 'rsp_1',
            participant_id: 'agt_1',
            status: 'running',
        });
        upsertResponseActivity('cht_1', 'rsp_1', {
            id: 'act_1',
            kind: 'tool_call',
            started_at: '2026-05-20T12:00:00.000Z',
            status: 'running',
            title: 'Using tool',
        });
        const { activity } = upsertResponseActivity('cht_1', 'rsp_1', {
            completed_at: '2026-05-20T12:00:10.000Z',
            id: 'act_1',
            kind: 'tool_call',
            started_at: '2026-05-20T12:00:10.000Z',
            status: 'completed',
            title: 'Using tool',
        });

        expect(activity).toMatchObject({
            completed_at: '2026-05-20T12:00:10.000Z',
            id: 'act_1',
            started_at: '2026-05-20T12:00:00.000Z',
            status: 'completed',
        });
    });

    it('rejects activity ids that already belong to another response', () => {
        createChat({ id: 'cht_1' });
        createChat({ id: 'cht_2' });
        upsertResponse('cht_1', {
            id: 'rsp_1',
            participant_id: 'agt_1',
            status: 'running',
        });
        upsertResponse('cht_2', {
            id: 'rsp_2',
            participant_id: 'agt_1',
            status: 'running',
        });
        upsertResponseActivity('cht_1', 'rsp_1', {
            id: 'act_1',
            kind: 'message',
            status: 'running',
            title: 'Assistant reply',
        });

        expect(() =>
            upsertResponseActivity('cht_2', 'rsp_2', {
                id: 'act_1',
                kind: 'message',
                status: 'running',
                title: 'Assistant reply',
            })
        ).toThrow('Activity act_1 belongs to response rsp_1 in chat cht_1.');
    });

    it('closes open activity when the response becomes terminal', () => {
        createChat({ id: 'cht_1' });
        upsertResponse('cht_1', {
            id: 'rsp_1',
            participant_id: 'agt_1',
            status: 'running',
        });
        upsertResponseActivity('cht_1', 'rsp_1', {
            id: 'act_1',
            kind: 'message',
            started_at: '2026-05-20T12:00:00.000Z',
            status: 'running',
            title: 'Assistant reply',
        });

        upsertResponse('cht_1', {
            completed_at: '2026-05-20T12:00:10.000Z',
            id: 'rsp_1',
            participant_id: 'agt_1',
            status: 'completed',
        });

        expect(listResponses('cht_1').activity).toMatchObject([
            {
                completed_at: expect.any(String),
                id: 'act_1',
                status: 'completed',
            },
        ]);
    });

    it('keeps response pagination stable when activity updates touch older responses', () => {
        createChat({ id: 'cht_1' });
        upsertResponse('cht_1', {
            id: 'rsp_1',
            participant_id: 'agt_1',
            status: 'running',
        });
        upsertResponse('cht_1', {
            id: 'rsp_2',
            participant_id: 'agt_1',
            status: 'running',
        });

        const firstPage = listResponses('cht_1', { limit: 1 });

        upsertResponseActivity('cht_1', 'rsp_1', {
            id: 'act_1',
            kind: 'tool_call',
            status: 'running',
            title: 'Using tool',
        });
        getDb()
            .prepare(
                "UPDATE chat_responses SET updated_at = '2099-01-01T00:00:00.000Z' WHERE id = 'rsp_1'"
            )
            .run();

        expect(firstPage.responses.map((response) => response.id)).toEqual(['rsp_1']);
        expect(
            listResponses('cht_1', {
                afterSequence: firstPage.next_sequence ?? 0,
                limit: 1,
            }).responses.map((response) => response.id)
        ).toEqual(['rsp_2']);
    });

    it('does not terminalize the parent response when activity completes or fails', () => {
        createChat({ id: 'cht_1' });
        upsertResponse('cht_1', {
            id: 'rsp_1',
            participant_id: 'agt_1',
            status: 'queued',
        });
        upsertResponseActivity('cht_1', 'rsp_1', {
            id: 'act_1',
            kind: 'tool_call',
            status: 'completed',
            title: 'Used tool',
        });
        upsertResponseActivity('cht_1', 'rsp_1', {
            id: 'act_2',
            kind: 'tool_call',
            status: 'failed',
            title: 'Used other tool',
        });

        expect(getResponse('rsp_1')).toMatchObject({
            completed_at: null,
            id: 'rsp_1',
            status: 'running',
        });
    });

    it('gets response activity by stable id', () => {
        createChat({ id: 'cht_1' });
        upsertResponse('cht_1', {
            id: 'rsp_1',
            participant_id: 'agt_1',
            status: 'running',
        });
        upsertResponseActivity('cht_1', 'rsp_1', {
            id: 'act_1',
            kind: 'tool_call',
            status: 'running',
            title: 'Using tool',
        });

        expect(getResponseActivity('act_1')).toMatchObject({
            chat_id: 'cht_1',
            id: 'act_1',
            response_id: 'rsp_1',
            title: 'Using tool',
        });
    });

    it('publishes private read events only to matching recipients', () => {
        const publicEvents: string[] = [];
        const readerEvents: string[] = [];
        const otherEvents: string[] = [];
        const unsubscribers = [
            subscribeToTavernApiEvents((event) => publicEvents.push(event.type)),
            subscribeToTavernApiEvents((event) => readerEvents.push(event.type), {
                recipientId: 'usr_1',
            }),
            subscribeToTavernApiEvents((event) => otherEvents.push(event.type), {
                recipientId: 'usr_2',
            }),
        ];

        try {
            createChat({ id: 'cht_1' });
            createMessage('cht_1', messageInput('msg_1', 'nonce_1', 'hello'));
            markRead('cht_1', {
                last_read_sequence: 1,
                reader_id: 'usr_1',
            });
        } finally {
            for (const unsubscribe of unsubscribers) {
                unsubscribe();
            }
        }

        expect(publicEvents).toEqual(['message.created']);
        expect(readerEvents).toEqual(['message.created', 'chat.read']);
        expect(otherEvents).toEqual(['message.created']);
    });

    it('keeps durable writes successful when a live event subscriber fails', () => {
        const unsubscribe = subscribeToTavernApiEvents(() => {
            throw new Error('subscriber failed');
        });

        try {
            createChat({ id: 'cht_1' });
            const receipt = createDelivery('cht_1', {
                agent_id: 'agt_1',
                id: 'del_1',
                message: {
                    ...messageInput('msg_agt_1', undefined, 'done'),
                    author_id: 'agt_1',
                    metadata: {
                        runtime: {
                            agentId: 'agt_1',
                            agentSessionId: 'ags_1',
                            runId: 'run_1',
                            source: 'test',
                        },
                    },
                    role: 'assistant',
                },
                turn_id: 'run_1',
            });

            expect(receipt.message.id).toBe('msg_agt_1');
            expect(listMessages('cht_1').messages).toHaveLength(1);
            expect(listEvents().events.at(-1)?.type).toBe('message.delivered');
        } finally {
            unsubscribe();
        }
    });

    it('listEvents visibility parity: public events visible to all, private events only to addressed recipient', () => {
        const db = getDb();
        createChat({ id: 'cht_1' });
        insertEvent({ chatId: 'cht_1', event: 'message.created', payload: { label: 'pub1' } }, db);
        insertEvent(
            {
                chatId: 'cht_1',
                event: 'message.created',
                payload: { label: 'priv-A' },
                private: true,
                recipients: ['A'],
            },
            db
        );
        insertEvent(
            {
                chatId: 'cht_1',
                event: 'message.created',
                payload: { label: 'priv-B' },
                private: true,
                recipients: ['B'],
            },
            db
        );
        insertEvent({ chatId: 'cht_1', event: 'message.created', payload: { label: 'pub2' } }, db);

        const forA = listEvents({ recipientId: 'A' });
        expect(forA.events).toHaveLength(3);
        expect(forA.events.map((e) => (e as Record<string, unknown>).label)).toEqual([
            'pub1',
            'priv-A',
            'pub2',
        ]);

        const forNone = listEvents({});
        expect(forNone.events).toHaveLength(2);
        expect(forNone.events.map((e) => (e as Record<string, unknown>).label)).toEqual([
            'pub1',
            'pub2',
        ]);
    });

    it('listEvents limit and next_cursor: pages correctly across visible events', () => {
        const db = getDb();
        createChat({ id: 'cht_1' });
        const limit = 3;
        for (let i = 1; i <= limit + 2; i++) {
            insertEvent({ chatId: 'cht_1', event: 'message.created', payload: { seq: i } }, db);
        }

        const page1 = listEvents({ limit });
        expect(page1.events).toHaveLength(limit);
        expect(page1.next_cursor).toBe(page1.events.at(-1)?.cursor ?? null);
        expect(page1.next_cursor).not.toBeNull();

        const page2 = listEvents({ limit, afterCursor: page1.next_cursor });
        expect(page2.events).toHaveLength(2);
        expect(page2.next_cursor).toBeNull();
    });

    it('listEvents private events do not consume the page: skipped in SQL, not counted against limit', () => {
        const db = getDb();
        createChat({ id: 'cht_1' });
        for (let i = 0; i < 5; i++) {
            insertEvent(
                {
                    chatId: 'cht_1',
                    event: 'message.created',
                    payload: { seq: i },
                    private: true,
                    recipients: ['other'],
                },
                db
            );
        }
        for (let i = 0; i < 3; i++) {
            insertEvent({ chatId: 'cht_1', event: 'message.created', payload: { seq: i } }, db);
        }

        const result = listEvents({ limit: 3 });
        expect(result.events).toHaveLength(3);
        expect(result.next_cursor).toBeNull();
    });
});

describe('Tavern Runtime Chat API routes', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    it('returns OpenAPI-shaped route payloads', async () => {
        await handleTavernRuntimeRequest(
            jsonRequest('POST', '/api/chats', {
                id: 'cht_1',
                title: 'Test',
            })
        );
        const response = await handleTavernRuntimeRequest(
            jsonRequest(
                'POST',
                '/api/chats/cht_1/messages',
                messageInput('msg_1', 'nonce_1', 'hello')
            )
        );

        expect(response.status).toBe(201);
        await expect(response.json()).resolves.toMatchObject({
            idempotent: false,
            message: {
                chat_id: 'cht_1',
                id: 'msg_1',
                sequence: 1,
            },
        });

        const replay = await handleTavernRuntimeRequest(
            jsonRequest(
                'POST',
                '/api/chats/cht_1/messages',
                messageInput('msg_retry', 'nonce_1', 'hello')
            )
        );

        expect(replay.status).toBe(200);
        await expect(replay.json()).resolves.toMatchObject({
            idempotent: true,
            message: {
                id: 'msg_1',
                sequence: 1,
            },
        });
    });

    it('soft-deletes responses and clears chats through the chat API routes', async () => {
        createChat({ id: 'cht_1' });
        createMessage('cht_1', messageInput('msg_1', 'nonce_1', 'hello'));
        upsertResponse('cht_1', {
            id: 'rsp_1',
            participant_id: 'agt_1',
            status: 'completed',
        });

        const deleted = await handleTavernRuntimeRequest(
            new Request('http://127.0.0.1:18790/api/responses/rsp_1', { method: 'DELETE' })
        );
        expect(deleted.status).toBe(200);
        await expect(deleted.json()).resolves.toMatchObject({ response_id: 'rsp_1' });

        const cleared = await handleTavernRuntimeRequest(
            jsonRequest('POST', '/api/chats/cht_1/clear', {})
        );
        expect(cleared.status).toBe(200);
        await expect(cleared.json()).resolves.toMatchObject({
            chat_id: 'cht_1',
            messages_deleted: 1,
            responses_deleted: 0,
        });
    });

    it('gets durable response activity through the chat API route', async () => {
        createChat({ id: 'cht_1' });
        upsertResponse('cht_1', {
            id: 'rsp_1',
            participant_id: 'agt_1',
            status: 'running',
        });
        upsertResponseActivity('cht_1', 'rsp_1', {
            id: 'act_1',
            kind: 'tool_call',
            status: 'running',
            title: 'Using tool',
        });

        const response = await handleTavernRuntimeRequest(
            getRequest('/api/chats/cht_1/activity/act_1')
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            chat_id: 'cht_1',
            id: 'act_1',
            response_id: 'rsp_1',
            title: 'Using tool',
        });
    });

    it('searches durable messages through the chat API route', async () => {
        await handleTavernRuntimeRequest(jsonRequest('POST', '/api/chats', { id: 'cht_1' }));
        await handleTavernRuntimeRequest(
            jsonRequest(
                'POST',
                '/api/chats/cht_1/messages',
                messageInput('msg_1', 'nonce_1', 'save this podcast takeaway')
            )
        );
        await handleTavernRuntimeRequest(
            jsonRequest(
                'POST',
                '/api/chats/cht_1/messages',
                messageInput('msg_2', 'nonce_2', 'unrelated note')
            )
        );

        const response = await handleTavernRuntimeRequest(
            getRequest('/api/chats/cht_1/messages/search?query=podcast&limit=5')
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            messages: [{ id: 'msg_1', content: 'save this podcast takeaway', sequence: 1 }],
            next_sequence: null,
        });
    });

    it('filters private event lists by recipient', async () => {
        await handleTavernRuntimeRequest(jsonRequest('POST', '/api/chats', { id: 'cht_1' }));
        await handleTavernRuntimeRequest(
            jsonRequest(
                'POST',
                '/api/chats/cht_1/messages',
                messageInput('msg_1', 'nonce_1', 'hello')
            )
        );
        await handleTavernRuntimeRequest(
            jsonRequest('POST', '/api/chats/cht_1/read', {
                last_read_sequence: 1,
                reader_id: 'usr_1',
            })
        );

        const otherRecipient = await handleTavernRuntimeRequest(
            getRequest('/api/events?recipient_id=usr_2')
        );
        await expect(otherRecipient.json()).resolves.toMatchObject({
            events: [{ type: 'message.created' }],
        });

        const readerRecipient = await handleTavernRuntimeRequest(
            getRequest('/api/events?recipient_id=usr_1')
        );
        await expect(readerRecipient.json()).resolves.toMatchObject({
            events: [{ type: 'message.created' }, { type: 'chat.read' }],
        });
    });

    it('returns runtime projection events from the durable chat event log', async () => {
        await handleTavernRuntimeRequest(jsonRequest('POST', '/api/chats', { id: 'cht_1' }));
        await handleTavernRuntimeRequest(
            jsonRequest('POST', '/api/chats/cht_1/messages', {
                ...messageInput('msg_1', 'nonce_1', 'hello'),
                metadata: {
                    runtime: {
                        agentId: 'agt_1',
                        agentSessionId: 'ags_1',
                        runId: 'run_1',
                    },
                },
            })
        );

        const response = await handleTavernRuntimeRequest(getRequest(runtimeRoutes.events));

        await expect(response.json()).resolves.toMatchObject({
            events: [
                {
                    agentId: 'agt_1',
                    chatId: 'cht_1',
                    message: {
                        id: 'msg_1',
                        sequence: 1,
                        text: 'hello',
                    },
                    runId: 'run_1',
                    type: 'chat.messageAccepted',
                },
            ],
        });
    });

    it('filters runtime projection events after a durable cursor', async () => {
        await handleTavernRuntimeRequest(jsonRequest('POST', '/api/chats', { id: 'cht_1' }));
        for (const index of [1, 2]) {
            await handleTavernRuntimeRequest(
                jsonRequest('POST', '/api/chats/cht_1/messages', {
                    ...messageInput(`msg_${index}`, `nonce_${index}`, `hello ${index}`),
                    metadata: {
                        runtime: {
                            agentId: 'agt_1',
                            agentSessionId: 'ags_1',
                            runId: `run_${index}`,
                        },
                    },
                })
            );
        }

        const response = await handleTavernRuntimeRequest(
            getRequest(`${runtimeRoutes.events}?after_cursor=1`)
        );

        await expect(response.json()).resolves.toMatchObject({
            events: [{ message: { id: 'msg_2' }, runId: 'run_2', type: 'chat.messageAccepted' }],
        });
    });
});

function messageInput(id: string, nonce: string | undefined, content: string) {
    return {
        author_id: 'usr_1',
        content,
        id,
        ...(nonce ? { nonce } : {}),
        role: 'user' as const,
    };
}

function jsonRequest(method: string, path: string, body: unknown) {
    return new Request(`http://127.0.0.1:18790${path}`, {
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
        method,
    });
}

function getRequest(path: string) {
    return new Request(`http://127.0.0.1:18790${path}`);
}
