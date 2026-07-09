import type { AgentRuntimeTask } from '@tavern/api';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { upsertStoredAgent } from '../tavern/agents-store.ts';
import { claimTaskDispatch } from './dispatch-store.ts';
import { runAutoDispatchTick } from './dispatcher.ts';
import { isAutoDispatchEligible, orderAutoDispatchTasks } from './eligibility.ts';
import { saveAutoDispatchSettings } from './settings.ts';
import { createTask } from './store.ts';

describe('task auto-dispatch eligibility and claims', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
        upsertStoredAgent({
            agent: {
                autoDispatchEnabled: true,
                enabledSkillIds: [],
                id: 'agt_primary',
                isAdmin: false,
                name: 'Primary',
                primaryColor: null,
                taskReviewPolicy: false,
                workspaceFolder: '/tmp/agt_primary',
            },
        });
    });

    afterEach(() => closeDb());

    test('checks every eligibility hold including caps and a busy agent', () => {
        const task = buildTask();
        const eligible = eligibility();
        expect(isAutoDispatchEligible(task, eligible)).toBe(true);
        expect(isAutoDispatchEligible({ ...task, kind: 'epic' }, eligible)).toBe(false);
        expect(isAutoDispatchEligible({ ...task, status: 'backlog' }, eligible)).toBe(false);
        expect(isAutoDispatchEligible({ ...task, assignee: null }, eligible)).toBe(false);
        expect(isAutoDispatchEligible(task, { ...eligible, agentAutoDispatchEnabled: false })).toBe(
            false
        );
        expect(isAutoDispatchEligible(task, { ...eligible, dependenciesDone: false })).toBe(false);
        expect(isAutoDispatchEligible({ ...task, scheduledFor: '2026-07-10' }, eligible)).toBe(
            false
        );
        expect(isAutoDispatchEligible(task, { ...eligible, globalAtCapacity: true })).toBe(false);
        expect(isAutoDispatchEligible(task, { ...eligible, agentAtCapacity: true })).toBe(false);
        expect(isAutoDispatchEligible(task, { ...eligible, agentBusy: true })).toBe(false);
    });

    test('orders priority first, then oldest update', () => {
        const ordered = orderAutoDispatchTasks([
            buildTask({ id: 'low', priority: 'low' }),
            buildTask({ id: 'new', priority: 'high', updatedAt: '2026-07-09T13:00:00.000Z' }),
            buildTask({ id: 'old', priority: 'high', updatedAt: '2026-07-09T11:00:00.000Z' }),
            buildTask({ id: 'urgent', priority: 'urgent' }),
        ]);
        expect(ordered.map((task) => task.id)).toEqual(['urgent', 'old', 'new', 'low']);
    });

    test('allows only one winner for competing atomic claims', async () => {
        const task = createTask({
            assignee: { agentId: 'agt_primary', kind: 'agent' },
            id: 'tsk_claim',
            status: 'todo',
            title: 'Claim once',
        });
        const claim = () =>
            Promise.resolve(
                claimTaskDispatch({
                    agentId: 'agt_primary',
                    expectedUpdatedAt: task.updatedAt,
                    taskId: task.id,
                    trigger: 'auto',
                })
            );
        const results = await Promise.all([claim(), claim()]);
        expect(results.filter(Boolean)).toHaveLength(1);
        expect(results.find(Boolean)).toMatchObject({
            dispatchAttempts: 1,
            dispatchTrigger: 'auto',
            status: 'in_progress',
        });
    });

    test('manual claim overrides status and dependency holds', () => {
        const dependency = createTask({ id: 'tsk_dependency', title: 'Not done' });
        const task = createTask({
            assignee: { kind: 'user' },
            blockedBy: [dependency.id],
            blockedReason: { kind: 'needs_input', message: 'Waiting.' },
            id: 'tsk_manual',
            status: 'blocked',
            title: 'Override holds',
        });
        expect(
            claimTaskDispatch({
                agentId: 'agt_primary',
                expectedUpdatedAt: task.updatedAt,
                taskId: task.id,
                trigger: 'manual',
            })
        ).toMatchObject({
            assignee: { agentId: 'agt_primary', kind: 'agent' },
            blockedReason: null,
            dispatchAttempts: 1,
            dispatchTrigger: 'manual',
            status: 'in_progress',
        });
    });

    test('kill switch stops claims', async () => {
        createTask({
            assignee: { agentId: 'agt_primary', kind: 'agent' },
            id: 'tsk_off',
            status: 'todo',
            title: 'Stay queued',
        });
        saveAutoDispatchSettings({ autoDispatchEnabled: false });
        const dispatch = vi.fn();
        await runAutoDispatchTick({ dispatch });
        expect(dispatch).not.toHaveBeenCalled();
    });
});

function eligibility() {
    return {
        agentAtCapacity: false,
        agentAutoDispatchEnabled: true,
        agentBusy: false,
        dependenciesDone: true,
        globalAtCapacity: false,
        globalEnabled: true,
        localDate: '2026-07-09',
    };
}

function buildTask(overrides: Partial<AgentRuntimeTask> = {}): AgentRuntimeTask {
    return {
        activeDispatchRunId: null,
        assignee: { agentId: 'agt_primary', kind: 'agent' },
        attachments: [],
        blockedBy: [],
        blockedReason: null,
        createdAt: '2026-07-09T10:00:00.000Z',
        description: null,
        dispatchAttempts: 0,
        dispatchTrigger: null,
        epicId: null,
        id: 'tsk_1',
        kind: 'task',
        labels: [],
        number: 1,
        originChatId: null,
        priority: 'medium',
        scheduledFor: null,
        status: 'todo',
        summary: null,
        title: 'Eligible',
        updatedAt: '2026-07-09T12:00:00.000Z',
        workChatId: null,
        ...overrides,
    };
}
