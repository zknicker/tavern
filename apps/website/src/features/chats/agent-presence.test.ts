import { expect, test } from 'bun:test';
import { resolveBusyElsewhere, resolveDmPresenceLabel } from './agent-presence.tsx';

const busyInRoom = {
    agentId: 'agt_otto',
    chatId: 'cht_room',
    chatTitle: 'Launch prep',
    since: '2026-07-15T12:00:00.000Z',
    state: 'busy' as const,
};

test('DM presence label: silent when idle, replying here, working elsewhere', () => {
    expect(resolveDmPresenceLabel({ ...busyInRoom, state: 'idle' }, 'cht_dm')).toBeNull();
    expect(resolveDmPresenceLabel(busyInRoom, 'cht_room')).toBe('Replying…');
    expect(resolveDmPresenceLabel(busyInRoom, 'cht_dm')).toBe('Working in Launch prep…');
    expect(resolveDmPresenceLabel({ ...busyInRoom, chatTitle: null }, 'cht_dm')).toBe(
        'Working in another chat…'
    );
});

test('busy-elsewhere resolves only seated agents busy in a different chat', () => {
    const presence = [busyInRoom];

    expect(
        resolveBusyElsewhere({ boundAgentIds: ['agt_otto'], chatId: 'cht_dm', presence })
    ).toEqual(busyInRoom);
    // Busy in this chat: the active status stack owns that state.
    expect(
        resolveBusyElsewhere({ boundAgentIds: ['agt_otto'], chatId: 'cht_room', presence })
    ).toBeNull();
    expect(
        resolveBusyElsewhere({ boundAgentIds: ['agt_wren'], chatId: 'cht_dm', presence })
    ).toBeNull();
    expect(
        resolveBusyElsewhere({
            boundAgentIds: ['agt_otto'],
            chatId: 'cht_dm',
            presence: [{ ...busyInRoom, state: 'idle' as const }],
        })
    ).toBeNull();
});
