import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AgentCliMessage } from './agent-api-schemas.ts';
import { formatDeliveryEnvelope, formatHistoryLine, formatLocalTime } from './agent-format.ts';
import { renderHistory, renderSearchResult, renderSendResponse } from './agent-render.ts';

const originalTimezone = process.env.TZ;

beforeAll(() => {
    process.env.TZ = 'America/New_York';
});

afterAll(() => {
    process.env.TZ = originalTimezone;
});

const humanMessage: AgentCliMessage = {
    attachments: [],
    author: { id: 'usr_tavern', kind: 'user', label: 'zach', metadata: {} },
    chat_id: 'cht_general',
    content: 'hello',
    created_at: '2026-07-21T18:02:11.000Z',
    deleted_at: null,
    delivery_id: null,
    id: 'msg_1a2b3c4d00000000',
    metadata: {},
    nonce: null,
    role: 'user',
    sender: { description: 'Grotto operator', handle: 'zach', type: 'human' },
    sequence: 42,
};

describe('agent message formatting', () => {
    test('renders local wall-clock time', () => {
        expect(formatLocalTime(humanMessage.created_at)).toBe('2026-07-21 14:02:11');
    });

    test('renders delivery and history golden lines', () => {
        expect(formatDeliveryEnvelope('#general', humanMessage)).toBe(
            '[target=#general msg=1a2b3c4d time=2026-07-21 14:02:11 type=human] @zach — Grotto operator: hello'
        );
        expect(
            formatHistoryLine({
                ...humanMessage,
                replyCount: 2,
                replyTarget: '#general:1a2b3c4d',
                sender: { description: 'resident generalist', handle: 'Tavern', type: 'agent' },
                threadId: 'cht_thread',
            })
        ).toBe(
            '[seq=42 msg=msg_1a2b3c4d00000000 time=2026-07-21 14:02:11 type=agent threadId=cht_thread replyCount=2 replyTarget=#general:1a2b3c4d] @Tavern — resident generalist: hello'
        );
    });

    test('renders handleless system senders as @unknown instead of failing', () => {
        expect(
            formatDeliveryEnvelope('#general', {
                ...humanMessage,
                sender: { description: null, handle: null, type: 'system' },
            })
        ).toBe(
            '[target=#general msg=1a2b3c4d time=2026-07-21 14:02:11 type=system] @unknown: hello'
        );
    });

    test('renders history teaching and pagination', () => {
        expect(
            renderHistory({
                has_more: true,
                has_newer: false,
                has_older: true,
                last_read: { after: 41, unread_after: 41 },
                messages: [humanMessage],
                target: '#general',
            })
        ).toContain('--- 1 messages shown. Use --before 42 to see older messages. ---');
    });

    test('renders held draft paths and bounded context', () => {
        const output = renderSendResponse('#general', {
            continueAnywaySuggested: true,
            formalMentionCount: 1,
            newMessageCount: 4,
            omittedMessageCount: 3,
            reholdCount: 2,
            shownMessages: [humanMessage],
            state: 'held',
        });
        expect(output).toContain('Freshness hold: showing latest 1 of 4 newer messages.');
        expect(output).toContain('Your message has been saved as a draft.');
        expect(output).toContain('grotto message send --send-draft --anyway --target "#general"');
    });

    test('renders search blocks with bounded match windows', () => {
        const output = renderSearchResult(
            '#general',
            { ...humanMessage, content: `${'x'.repeat(90)}needle${'y'.repeat(130)}` },
            'needle'
        );
        expect(output).toContain('<result ref="msg:msg_1a2b3c4d00000000">');
        expect(output).toContain('Source: #general');
        expect(output).toContain('<omit />');
        expect(output).toContain('<match>needle</match>');
    });
});
