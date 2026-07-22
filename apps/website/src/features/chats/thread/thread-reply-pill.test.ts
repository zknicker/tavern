import { expect, test } from 'bun:test';
import { getThreadReplyPillText } from './thread-reply-pill.tsx';

const now = Date.parse('2026-07-21T16:00:00.000Z');

test('thread reply pill text uses singular reply copy', () => {
    expect(
        getThreadReplyPillText(
            { latestReplyAt: '2026-07-21T15:55:00.000Z', replyCount: 1, unreadCount: 0 },
            now
        )
    ).toEqual({ qualifier: '5m ago', replyLabel: '1 reply', unread: false });
});

test('thread reply pill text uses plural reply and unread copy', () => {
    expect(
        getThreadReplyPillText(
            { latestReplyAt: '2026-07-21T15:55:00.000Z', replyCount: 3, unreadCount: 2 },
            now
        )
    ).toEqual({ qualifier: '2 new', replyLabel: '3 replies', unread: true });
});
