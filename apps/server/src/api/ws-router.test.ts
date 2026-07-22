import { expect, test } from 'bun:test';
import { wsRouter } from './ws-router.ts';

test('wsRouter exposes agent event subscriptions used by the app', () => {
    expect(Object.keys(wsRouter._def.procedures).filter((key) => key.startsWith('agent.'))).toEqual(
        ['agent.onEngineRestart', 'agent.onInstructionsUpdate', 'agent.onUpdate']
    );
});

test('wsRouter exposes all chat event subscriptions used by the app', () => {
    expect(Object.keys(wsRouter._def.procedures).filter((key) => key.startsWith('chat.'))).toEqual([
        'chat.onComposition',
        'chat.log.onUpdate',
        'chat.onUpdate',
    ]);
});
