import { expect, test } from 'bun:test';
import { type AgentActivityEntry, formatAgentActivityEntry } from './agent-activity-labels.ts';

function entry(overrides: Partial<AgentActivityEntry>): AgentActivityEntry {
    return {
        at: '2026-07-15T20:00:00.000Z',
        chatId: 'cht_room',
        chatTitle: 'Launch prep',
        detail: null,
        kind: 'replied',
        turnId: 'run_1',
        ...overrides,
    };
}

// Mirrors the entry catalog in specs/agent-activity.md — the rendering
// contract. A drift here means the spec table or this module lied.
test('labels match the spec entry catalog', () => {
    expect(formatAgentActivityEntry(entry({ detail: 'You', kind: 'message_received' }))).toBe(
        'Message received in Launch prep — from You'
    );
    expect(formatAgentActivityEntry(entry({ kind: 'replied' }))).toBe('Replied in Launch prep');
    expect(formatAgentActivityEntry(entry({ kind: 'declined' }))).toBe(
        'Chose not to reply in Launch prep'
    );
    expect(formatAgentActivityEntry(entry({ kind: 'failed' }))).toBe('Turn failed in Launch prep');
    expect(formatAgentActivityEntry(entry({ kind: 'stopped' }))).toBe('Stopped in Launch prep');
    expect(
        formatAgentActivityEntry(entry({ detail: 'daily digest', kind: 'automation_fired' }))
    ).toBe('Automation fired: daily digest — in Launch prep');
    expect(
        formatAgentActivityEntry(entry({ detail: 'Ship the launch page', kind: 'task_dispatched' }))
    ).toBe('Task dispatched: Ship the launch page');
    expect(
        formatAgentActivityEntry(
            entry({ chatId: null, chatTitle: null, detail: 'manual reset', kind: 'new_session' })
        )
    ).toBe('Started fresh session — manual reset');
});

test('labels degrade without detail and fall back to chat ids', () => {
    expect(formatAgentActivityEntry(entry({ detail: null, kind: 'message_received' }))).toBe(
        'Message received in Launch prep'
    );
    expect(formatAgentActivityEntry(entry({ detail: null, kind: 'automation_fired' }))).toBe(
        'Automation fired — in Launch prep'
    );
    expect(formatAgentActivityEntry(entry({ chatTitle: null, kind: 'replied' }))).toBe(
        'Replied in cht_room'
    );
    expect(
        formatAgentActivityEntry(entry({ chatId: null, chatTitle: null, kind: 'new_session' }))
    ).toBe('Started fresh session');
});
