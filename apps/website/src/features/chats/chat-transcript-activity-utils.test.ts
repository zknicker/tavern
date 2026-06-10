import { expect, test } from 'bun:test';
import {
    type ActivityItem,
    formatWorkGroupHeader,
    formatWorkGroupSummary,
    getActiveWorkLabel,
} from './chat-transcript-activity-utils.ts';

test('active work label shows the command target while it runs', () => {
    const label = getActiveWorkLabel([
        toolItem({ name: 'terminal', running: true, summaryParts: ["sleep 2 && date '+%H:%M'"] }),
    ]);

    expect(label).toBe("Running sleep 2 && date '+%H:%M'");
});

test('active work label never echoes a bare tool name as the target', () => {
    const command = getActiveWorkLabel([
        toolItem({ label: 'terminal', name: 'terminal', running: true, summaryParts: [] }),
    ]);
    const generic = getActiveWorkLabel([
        toolItem({ label: 'memorize', name: 'memorize', running: true, summaryParts: [] }),
    ]);

    expect(command).toBe('Running a command');
    expect(generic).toBe('Using memorize');
});

test('work group summary counts commands and web searches in product language', () => {
    const items = [
        toolItem({ name: 'terminal', summaryParts: ['pwd'] }),
        toolItem({ id: 'tool-2', name: 'terminal', summaryParts: ['ls'] }),
        toolItem({ id: 'tool-3', name: 'search_web', summaryParts: ['weather NYC'] }),
    ];

    expect(formatWorkGroupSummary(items)).toBe('Ran 2 commands, searched web 1 time');
});

test('work group header falls back to Worked when nothing is countable', () => {
    expect(formatWorkGroupSummary([])).toBeNull();
    expect(formatWorkGroupHeader([])).toBe('Worked');
});

function toolItem(input: {
    id?: string;
    label?: string;
    name: string;
    running?: boolean;
    summaryParts: string[];
}): ActivityItem {
    return {
        kind: 'row',
        row: {
            actor: { id: 'agent-1', kind: 'agent' },
            completedAt: input.running ? null : '2026-05-11T16:00:05.000Z',
            connectsToNext: false,
            connectsToPrevious: false,
            id: input.id ?? 'tool-1',
            isFirstInGroup: true,
            kind: 'tool',
            sessionKey: 'session-1',
            spawnedRelationships: [],
            startedAt: '2026-05-11T16:00:01.000Z',
            toolCall: {
                callId: null,
                facts: [],
                label: input.label ?? input.summaryParts.join(' '),
                name: input.name,
                status: null,
                summaryParts: input.summaryParts,
            },
        },
    } as ActivityItem;
}
