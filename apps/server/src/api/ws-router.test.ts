import { expect, test } from 'bun:test';
import { wsRouter } from './ws-router.ts';

test('wsRouter exposes agent event subscriptions used by the app', () => {
    expect(Object.keys(wsRouter._def.procedures).filter((key) => key.startsWith('agent.'))).toEqual(
        ['agent.onEngineRestart', 'agent.onInstructionsUpdate', 'agent.onUpdate']
    );
});

test('wsRouter exposes all chat event subscriptions used by the app', () => {
    expect(Object.keys(wsRouter._def.procedures).filter((key) => key.startsWith('chat.'))).toEqual([
        'chat.log.onUpdate',
        'chat.onTurnCompleted',
        'chat.onTurnCancelled',
        'chat.onTurnFailed',
        'chat.onTurnProgress',
        'chat.onTurnReplyUpdated',
        'chat.onTurnStarted',
        'chat.onTurnStatusUpdated',
        'chat.onUpdate',
    ]);
});

test('wsRouter exposes Wiki event subscriptions used by the app', () => {
    expect(Object.keys(wsRouter._def.procedures).filter((key) => key.startsWith('wiki.'))).toEqual([
        'wiki.onUpdate',
    ]);
});

test('wsRouter exposes label event subscriptions used by the app', () => {
    expect(
        Object.keys(wsRouter._def.procedures).filter((key) => key.startsWith('labels.'))
    ).toEqual(['labels.onUpdate']);
});
