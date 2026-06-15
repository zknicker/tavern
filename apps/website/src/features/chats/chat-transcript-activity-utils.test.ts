import { expect, test } from 'bun:test';
import {
    type ActivityItem,
    formatActiveWorkGroupHeader,
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

test('active work group header does not flash count summaries between fast tools', () => {
    const label = formatActiveWorkGroupHeader([
        toolItem({ name: 'search_files', summaryParts: ['query one'] }),
        toolItem({ id: 'tool-2', name: 'search_files', summaryParts: ['query two'] }),
    ]);

    expect(label).toBe('Working');
});

test('active work group header still shows the current running tool synopsis', () => {
    const label = formatActiveWorkGroupHeader([
        toolItem({ name: 'search_files', summaryParts: ['query one'] }),
        toolItem({ id: 'tool-2', name: 'terminal', running: true, summaryParts: ['bun test'] }),
    ]);

    expect(label).toBe('Running bun test');
});

test('active work label never echoes a bare tool name as the target', () => {
    const command = getActiveWorkLabel([
        toolItem({ label: 'terminal', name: 'terminal', running: true, summaryParts: [] }),
    ]);
    const edit = getActiveWorkLabel([
        toolItem({ label: 'write', name: 'write', running: true, summaryParts: [] }),
    ]);
    const generic = getActiveWorkLabel([
        toolItem({ label: 'memorize', name: 'memorize', running: true, summaryParts: [] }),
    ]);

    expect(command).toBe('Running a command');
    expect(edit).toBe('Editing a file');
    expect(generic).toBe('Using memorize');
});

test('active work label uses edit language for file writes', () => {
    const label = getActiveWorkLabel([
        toolItem({ name: 'write_file', running: true, summaryParts: ['SOUL.md'] }),
    ]);
    const replaceLabel = getActiveWorkLabel([
        toolItem({ name: 'replace', running: true, summaryParts: ['SOUL.md'] }),
    ]);

    expect(label).toBe('Editing SOUL.md');
    expect(replaceLabel).toBe('Editing SOUL.md');
});

test('active work label does not treat plan updates as file edits', () => {
    const label = getActiveWorkLabel([
        toolItem({ label: 'update_plan', name: 'update_plan', running: true, summaryParts: [] }),
    ]);

    expect(label).toBe('Using update_plan');
});

test('work group summary counts commands and web searches in product language', () => {
    const items = [
        toolItem({ name: 'terminal', summaryParts: ['pwd'] }),
        toolItem({ id: 'tool-2', name: 'terminal', summaryParts: ['ls'] }),
        toolItem({ id: 'tool-3', name: 'search_web', summaryParts: ['weather NYC'] }),
    ];

    expect(formatWorkGroupSummary(items)).toBe('Ran 2 commands, searched web');
});

test('work group summary keeps file reads and code search distinct', () => {
    const items = [
        toolItem({ name: 'tool_search_tool', summaryParts: ['browser'] }),
        toolItem({ id: 'tool-2', name: 'read_file', summaryParts: ['README.md'] }),
        toolItem({ id: 'tool-3', name: 'read_file', summaryParts: ['package.json'] }),
        toolItem({ id: 'tool-4', name: 'search_files', summaryParts: ['SOUL.md'] }),
        toolItem({ id: 'tool-5', name: 'exec', summaryParts: ['bun test'] }),
    ];

    expect(formatWorkGroupSummary(items)).toBe(
        'Used a tool, read 2 files, searched code, ran a command'
    );
});

test('work group summary does not treat memory search as code search', () => {
    const items = [toolItem({ name: 'memory_search', summaryParts: ['SOUL.md'] })];

    expect(formatWorkGroupSummary(items)).toBe('Used a tool');
});

test('work group summary does not treat message reads as file reads', () => {
    const items = [toolItem({ label: 'read · #general', name: 'message', summaryParts: ['read'] })];

    expect(formatWorkGroupSummary(items)).toBe('Used a tool');
});

test('work group summary combines generic tool counts', () => {
    const items = [
        toolItem({ name: 'tool_search_tool', summaryParts: ['browser'] }),
        toolItem({ id: 'tool-2', name: 'memory_search', summaryParts: ['SOUL.md'] }),
    ];

    expect(formatWorkGroupSummary(items)).toBe('Used 2 tools');
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
