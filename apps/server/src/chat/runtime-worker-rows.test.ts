import assert from 'node:assert/strict';
import test from 'node:test';
import type { TavernResponseActivity } from '@tavern/sdk';
import { workerRowFromSubagentActivity } from './runtime-worker-rows.ts';

const actor = { id: 'agt_primary', kind: 'agent' as const };

test('projects a subagent activity into a worker row from source facts', () => {
    const row = workerRowFromSubagentActivity({
        activity: activity({
            completedAt: '2026-06-10T12:01:00.000Z',
            detail: 'Summarized 12 files.',
            status: 'completed',
            subagent: {
                goal: 'Summarize the repo',
                parentId: 'sub_root',
                subagentId: 'sub_1',
                summary: 'Summarized 12 files.',
            },
        }),
        actor,
        agentName: 'Tavern Agent',
        sessionKey: 'agent:main:tavern:cht_1',
    });

    assert.ok(row);
    assert.equal(row.kind, 'worker');
    assert.equal(row.id, 'act_run_1_subagent_sub_1');
    assert.equal(row.startedAt, '2026-06-10T12:00:00.000Z');
    assert.equal(row.completedAt, '2026-06-10T12:01:00.000Z');
    assert.deepEqual(
        {
            agentName: row.worker.agentName,
            id: row.worker.id,
            kind: row.worker.kind,
            parentWorkerId: row.worker.parentWorkerId,
            status: row.worker.status,
            terminalSummary: row.worker.terminalSummary,
            title: row.worker.title,
        },
        {
            agentName: 'Tavern Agent',
            id: 'sub_1',
            kind: 'subagent',
            parentWorkerId: 'sub_root',
            status: 'succeeded',
            terminalSummary: 'Summarized 12 files.',
            title: 'Summarize the repo',
        }
    );
});

test('running subagent activities project as running workers without a terminal summary', () => {
    const row = workerRowFromSubagentActivity({
        activity: activity({
            detail: 'Reading README.md',
            status: 'running',
            subagent: { goal: 'Summarize the repo', subagentId: 'sub_1', summary: 'partial' },
        }),
        actor,
        agentName: null,
        sessionKey: null,
    });

    assert.ok(row);
    assert.equal(row.worker.status, 'running');
    assert.equal(row.worker.terminalSummary, null);
    assert.equal(row.worker.agentName, actor.id);
});

test('fails the worker mapping when the stable subagent id is missing', () => {
    const row = workerRowFromSubagentActivity({
        activity: activity({ status: 'running', subagent: { goal: 'No identity' } }),
        actor,
        agentName: null,
        sessionKey: null,
    });

    assert.equal(row, null);
});

test('ignores activities without subagent source facts', () => {
    const row = workerRowFromSubagentActivity({
        activity: activity({ status: 'running' }),
        actor,
        agentName: null,
        sessionKey: null,
    });

    assert.equal(row, null);
});

function activity(input: {
    completedAt?: string;
    detail?: string;
    status: TavernResponseActivity['status'];
    subagent?: Record<string, unknown>;
}): TavernResponseActivity {
    return {
        artifact_ids: [],
        chat_id: 'cht_1',
        completed_at: input.completedAt ?? null,
        detail: input.detail ?? null,
        id: 'act_run_1_subagent_sub_1',
        kind: 'custom',
        metadata: input.subagent ? { subagent: input.subagent } : {},
        response_id: 'rsp_run_1',
        sequence: 1,
        started_at: '2026-06-10T12:00:00.000Z',
        status: input.status,
        summary: null,
        title: 'Summarize the repo',
        updated_at: input.completedAt ?? '2026-06-10T12:00:30.000Z',
    } as TavernResponseActivity;
}
