import { expect, test } from 'bun:test';
import { type AgentActivityEntry, formatAgentActivityEntry } from './agent-activity-labels.ts';

function entry(overrides: Partial<AgentActivityEntry>): AgentActivityEntry {
    return {
        at: '2026-07-15T20:00:00.000Z',
        detail: null,
        kind: 'completed',
        turnId: 'run_1',
        ...overrides,
    };
}

// Mirrors the entry catalog in specs/agent-activity.md — the rendering
// contract. A drift here means the spec table or this module lied.
test('labels match the spec entry catalog', () => {
    expect(formatAgentActivityEntry(entry({ detail: 'You', kind: 'message_received' }))).toBe(
        'Message received — from You'
    );
    expect(
        formatAgentActivityEntry(entry({ detail: 'Ship the launch page', kind: 'completed' }))
    ).toBe('Replied — Ship the launch page');
    expect(formatAgentActivityEntry(entry({ kind: 'failed' }))).toBe('Turn failed');
    expect(formatAgentActivityEntry(entry({ kind: 'stopped' }))).toBe('Stopped');
    expect(formatAgentActivityEntry(entry({ detail: 'manual reset', kind: 'new_session' }))).toBe(
        'Started fresh session — manual reset'
    );
});

test('labels degrade without detail', () => {
    expect(formatAgentActivityEntry(entry({ detail: null, kind: 'message_received' }))).toBe(
        'Message received'
    );
    expect(formatAgentActivityEntry(entry({ detail: null, kind: 'completed' }))).toBe('Replied');
    expect(formatAgentActivityEntry(entry({ detail: null, kind: 'new_session' }))).toBe(
        'Started fresh session'
    );
});
