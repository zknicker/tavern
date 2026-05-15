import { expect, test } from 'bun:test';
import { wsRouter } from './ws-router.ts';

test('wsRouter exposes all chat event subscriptions used by the app', () => {
    expect(Object.keys(wsRouter._def.procedures).filter((key) => key.startsWith('chat.'))).toEqual([
        'chat.onTurnCompleted',
        'chat.onTurnFailed',
        'chat.onTurnProgress',
        'chat.onTurnReplyUpdated',
        'chat.onTurnStarted',
    ]);
});
