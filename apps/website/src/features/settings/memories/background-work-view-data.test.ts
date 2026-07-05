import { expect, test } from 'bun:test';
import {
    buildTimelineLanes,
    formatDuration,
    formatNextRun,
    readConsolidations,
    readPrunings,
    readReport,
    readSignals,
    readSkillActions,
    readTransitions,
    workerStatusDotClassName,
    workerStatusVariant,
} from './background-work-view-data.ts';

test('formatDuration renders compact human durations', () => {
    expect(formatDuration(null)).toBe(null);
    expect(formatDuration(420)).toBe('420ms');
    expect(formatDuration(4200)).toBe('4.2s');
    expect(formatDuration(42_000)).toBe('42s');
    expect(formatDuration(90_000)).toBe('1m 30s');
    expect(formatDuration(120_000)).toBe('2m');
});

test('formatNextRun handles disabled, waiting, and scheduled workers', () => {
    expect(formatNextRun(null, false)).toBe('—');
    expect(formatNextRun({ kind: 'scheduled', at: new Date().toISOString() }, false)).toBe('—');
    expect(formatNextRun({ kind: 'waiting', waitingOn: 'learning signals' }, true)).toBe(
        'Waiting on learning signals'
    );
    const inTwoHours = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    expect(formatNextRun({ kind: 'scheduled', at: inTwoHours }, true)).toBe('in 2h');
});

test('status maps to token dot classes and badge variants without hand-rolled colors', () => {
    expect(workerStatusDotClassName('completed')).toBe('bg-success');
    expect(workerStatusDotClassName('failed')).toBe('bg-error');
    expect(workerStatusDotClassName('running')).toBe('bg-info');
    expect(workerStatusDotClassName('skipped')).toBe('bg-muted-foreground/55');
    expect(workerStatusVariant('completed')).toBe('success');
    expect(workerStatusVariant('failed')).toBe('error');
});

test('buildTimelineLanes groups runs by kind, newest first, in a stable lane order', () => {
    const lanes = buildTimelineLanes([
        makeJob('a', 'extraction', '2026-07-01T10:00:00.000Z'),
        makeJob('b', 'extraction', '2026-07-03T10:00:00.000Z'),
        makeJob('c', 'curation', '2026-07-02T10:00:00.000Z'),
    ]);

    expect(lanes.map((lane) => lane.kind)).toEqual([
        'extraction',
        'dream',
        'skill_review',
        'curation',
    ]);
    expect(lanes[0].runs.map((run) => run.id)).toEqual(['b', 'a']);
    expect(lanes[3].runs.map((run) => run.id)).toEqual(['c']);
});

test('readSignals accepts both plain strings and structured signal records', () => {
    expect(
        readSignals({
            signals: ['use bun for tests', { detail: 'lint via ultracite', kind: 'technique' }],
        })
    ).toEqual(['use bun for tests', 'technique: lint via ultracite']);
    expect(readSignals({})).toEqual([]);
});

test('readSkillActions defaults path and tool but requires a skill id', () => {
    expect(
        readSkillActions({
            actions: [{ skillId: 'deploys', path: 'SKILL.md', tool: 'skill_patch' }, { path: 'x' }],
        })
    ).toEqual([{ path: 'SKILL.md', skillId: 'deploys', tool: 'skill_patch' }]);
});

test('curator metadata parses consolidations, prunings, and transitions defensively', () => {
    const metadata = {
        consolidations: [{ from: 'a', into: 'b', reason: 'overlap' }, { from: 'x' }],
        prunings: [{ name: 'stale', reason: 'unused' }],
        transitions: [{ skillId: 's1', previousState: 'active', nextState: 'archived' }],
    };
    expect(readConsolidations(metadata)).toEqual([{ from: 'a', into: 'b', reason: 'overlap' }]);
    expect(readPrunings(metadata)).toEqual([{ name: 'stale', reason: 'unused' }]);
    expect(readTransitions(metadata)).toEqual([{ from: 'active', skillId: 's1', to: 'archived' }]);
});

test('readReport keeps text and tool errors, drops empty reports', () => {
    expect(
        readReport({
            report: { text: 'done', toolErrors: [{ error: 'boom', tool: 'skill_patch' }] },
        })
    ).toEqual({ text: 'done', toolErrors: [{ error: 'boom', tool: 'skill_patch' }] });
    expect(readReport({ report: { text: '   ', toolErrors: [] } })).toBe(null);
    expect(readReport({})).toBe(null);
});

function makeJob(id: string, kind: 'curation' | 'extraction', completedAt: string) {
    return {
        agentId: 'agt_1',
        agentParticipantId: null,
        chatId: null,
        completedAt,
        createdAt: completedAt,
        error: null,
        fileChangeCount: 0,
        id,
        kind,
        modelCategory: null,
        outputPath: null,
        sourceEndSequence: null,
        sourceStartSequence: null,
        status: 'completed' as const,
        updatedAt: completedAt,
    };
}
