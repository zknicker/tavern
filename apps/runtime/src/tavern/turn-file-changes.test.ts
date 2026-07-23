import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import type { WorkspaceFileChange } from '../workspace/snapshot';
import { ensureCurrentAgentSession } from './agent-session-store';
import { createAgentTurn } from './agent-turn-store';
import { upsertStoredAgent } from './agents-store';
import { getAgentTurnFileEvidence, recordAgentTurnFileChanges } from './turn-file-changes';

describe('Tavern Runtime turn file changes', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
        seedTurn('run_files_1');
    });

    afterEach(() => {
        closeDb();
    });

    it('records and reads back a turn change set', () => {
        recordAgentTurnFileChanges({
            changes: [
                fileChange({ additions: 2, change: 'created', path: 'workbench/report.md' }),
                fileChange({
                    additions: 1,
                    beforeText: 'old\n',
                    change: 'modified',
                    deletions: 1,
                    path: 'NOTES.md',
                }),
            ],
            now: '2026-07-17T12:00:00.000Z',
            runId: 'run_files_1',
            truncated: false,
        });

        const evidence = getAgentTurnFileEvidence('run_files_1');
        expect(evidence).not.toBeNull();
        expect(evidence?.capturedAt).toBe('2026-07-17T12:00:00.000Z');
        expect(evidence?.truncated).toBe(false);
        expect(evidence?.changes.map((change) => change.path)).toEqual([
            'NOTES.md',
            'workbench/report.md',
        ]);
        expect(evidence?.changes[0]).toMatchObject({
            afterText: 'new\n',
            beforeText: 'old\n',
            change: 'modified',
        });
    });

    it('re-recording replaces the previous change set', () => {
        recordAgentTurnFileChanges({
            changes: [fileChange({ change: 'created', path: 'a.md' })],
            runId: 'run_files_1',
            truncated: false,
        });
        recordAgentTurnFileChanges({
            changes: [fileChange({ change: 'created', path: 'b.md' })],
            runId: 'run_files_1',
            truncated: false,
        });

        expect(getAgentTurnFileEvidence('run_files_1')?.changes.map((c) => c.path)).toEqual([
            'b.md',
        ]);
    });

    it('caps persisted changes and marks the evidence truncated', () => {
        const changes: WorkspaceFileChange[] = Array.from({ length: 401 }, (_, index) =>
            fileChange({ change: 'created', path: `workbench/file-${String(index)}.md` })
        );
        const recorded = recordAgentTurnFileChanges({
            changes,
            runId: 'run_files_1',
            truncated: false,
        });
        expect(recorded.truncated).toBe(true);
        expect(recorded.changes).toHaveLength(400);

        const evidence = getAgentTurnFileEvidence('run_files_1');
        expect(evidence?.truncated).toBe(true);
        expect(evidence?.changes).toHaveLength(400);
    });

    it('returns null for turns without recorded evidence', () => {
        expect(getAgentTurnFileEvidence('run_files_1')).toBeNull();
        expect(getAgentTurnFileEvidence('run_missing')).toBeNull();
    });
});

function seedTurn(runId: string) {
    upsertStoredAgent({
        agent: {
            enabledSkillIds: [],
            id: 'agt_files',
            isAdmin: false,
            name: 'Files',
            primaryColor: null,
            workspaceFolder: '/tmp/agt_files',
        },
    });
    const session = ensureCurrentAgentSession({ agentId: 'agt_files' });
    createAgentTurn({
        agentId: 'agt_files',
        agentSessionId: session.id,
        id: runId,
        kind: 'drain',
    });
}

function fileChange(input: Partial<WorkspaceFileChange> & { path: string }): WorkspaceFileChange {
    return {
        additions: input.additions ?? 1,
        afterSize: input.afterSize ?? 4,
        afterText: input.afterText ?? 'new\n',
        beforeSize: input.beforeSize ?? null,
        beforeText: input.beforeText ?? null,
        change: input.change ?? 'created',
        deletions: input.deletions ?? 0,
        omitted: input.omitted ?? null,
        path: input.path,
    };
}
