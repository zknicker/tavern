import { expect, test } from 'bun:test';
import { resolveDmPresenceLabel } from './agent-presence.tsx';

const busy = {
    agentId: 'agt_otto',
    pendingTurns: 1,
    since: '2026-07-15T12:00:00.000Z',
    state: 'busy' as const,
};

test('DM presence label: silent when idle, "Working…" when busy', () => {
    expect(resolveDmPresenceLabel({ ...busy, state: 'idle' }, 'cht_dm')).toBeNull();
    expect(resolveDmPresenceLabel(busy, 'cht_room')).toBe('Working…');
});
