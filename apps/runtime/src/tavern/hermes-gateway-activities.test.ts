import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { createChat, getResponseActivity, upsertResponse } from './chat-api';
import { createGatewayActivityRecorder } from './hermes-gateway-activities';
import { listProjectedTavernRuntimeEvents } from './runtime-event-projection';

const context = {
    agentId: 'agt_hermes',
    chatId: 'cht_1',
    responseId: 'rsp_run_1',
    runId: 'run_1',
    sessionKey: 'agent:main:tavern:cht_1',
};

describe('Hermes gateway activity recorder', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
        createChat({ id: context.chatId, title: 'Test' });
        upsertResponse(context.chatId, {
            id: context.responseId,
            participant_id: context.agentId,
            status: 'running',
        });
    });

    afterEach(() => {
        closeDb();
    });

    it('records a notice as a runtime-notice activity and completes it on clear', () => {
        const recorder = createGatewayActivityRecorder(context);

        recorder.recordNotice({
            id: 'ntc_1',
            key: 'credits',
            kind: 'credits',
            level: 'warning',
            text: 'Credits low.',
            ttl_ms: 60_000,
        });

        const running = findActivityByEvent('notification.show');
        expect(running).toMatchObject({
            detail: 'Credits low.',
            kind: 'custom',
            status: 'running',
            title: 'Agent notice',
        });
        expect(running?.metadata.runtime).toMatchObject({
            notice: {
                kind: 'status',
                level: 'warning',
                sourceKind: 'credits',
                text: 'Credits low.',
            },
            sessionKey: context.sessionKey,
        });
        expect(lastProjectedStep()).toMatchObject({ kind: 'notice', status: 'active' });

        recorder.clearNotice({ key: 'credits' });
        const cleared = getResponseActivity(running?.id ?? '');
        expect(cleared?.status).toBe('completed');
        expect(cleared?.completed_at).toBeTruthy();
        expect(lastProjectedStep()).toMatchObject({ kind: 'notice', status: 'completed' });
    });

    it('records spawn-tree progress under one activity keyed by subagent id', () => {
        const recorder = createGatewayActivityRecorder(context);

        recorder.recordWorker({
            depth: 1,
            goal: 'Summarize the repo',
            source_event: 'subagent.start',
            subagent_id: 'sub_1',
            task_count: 2,
            task_index: 0,
        });
        recorder.recordWorker({
            source_event: 'subagent.tool',
            subagent_id: 'sub_1',
            text: 'Reading README.md',
            tool_name: 'read_file',
        });
        recorder.recordWorker({
            cost_usd: 0.02,
            duration_seconds: 12.5,
            goal: 'Summarize the repo',
            output_tokens: 420,
            source_event: 'subagent.complete',
            status: 'done',
            subagent_id: 'sub_1',
            summary: 'Summarized 12 files.',
        });

        const activity = findActivityByEvent('subagent.complete');
        expect(activity).toMatchObject({
            detail: 'Summarized 12 files.',
            kind: 'custom',
            status: 'completed',
            title: 'Summarize the repo',
        });
        expect(activity?.metadata.subagent).toMatchObject({
            costUsd: 0.02,
            durationSeconds: 12.5,
            goal: 'Summarize the repo',
            outputTokens: 420,
            subagentId: 'sub_1',
            summary: 'Summarized 12 files.',
        });
        expect(lastProjectedStep()).toMatchObject({ kind: 'worker', status: 'completed' });
    });

    it('preserves worker title and source facts across terse progress updates', () => {
        const recorder = createGatewayActivityRecorder(context);

        recorder.recordWorker({
            depth: 1,
            goal: 'Summarize the repo',
            model: 'gpt-5',
            source_event: 'subagent.start',
            subagent_id: 'sub_1',
        });
        recorder.recordWorker({
            source_event: 'subagent.tool',
            subagent_id: 'sub_1',
            text: 'Reading README.md',
            tool_name: 'read_file',
        });

        const activity = findActivityByEvent('subagent.tool');
        expect(activity).toMatchObject({
            detail: 'Reading README.md',
            title: 'Summarize the repo',
        });
        expect(activity?.metadata.subagent).toMatchObject({
            depth: 1,
            goal: 'Summarize the repo',
            model: 'gpt-5',
            subagentId: 'sub_1',
            toolName: 'read_file',
        });
    });

    it('drops spawn-tree events without a stable subagent id', () => {
        const recorder = createGatewayActivityRecorder(context);

        recorder.recordWorker({ goal: 'No identity', source_event: 'subagent.start' });

        expect(projectedSteps()).toHaveLength(0);
    });

    it('records a pending approval and settles the oldest when the agent resumes', () => {
        const recorder = createGatewayActivityRecorder(context);

        expect(recorder.hasOpenApproval()).toBe(false);
        recorder.recordApproval({
            command: 'rm -rf build',
            description: 'Dangerous delete',
            pattern_key: 'rm -rf',
            pattern_keys: ['rm -rf'],
        });

        expect(recorder.hasOpenApproval()).toBe(true);
        const pending = findActivityByEvent('approval.request');
        expect(pending).toMatchObject({
            detail: 'Dangerous delete',
            kind: 'approval',
            status: 'running',
            title: 'Approval',
        });
        expect(pending?.metadata.approval).toMatchObject({
            command: 'rm -rf build',
            patternKey: 'rm -rf',
        });
        expect(lastProjectedStep()).toMatchObject({
            kind: 'approval',
            status: 'active',
            toolName: 'approval',
        });

        recorder.settleOldestApproval();
        expect(recorder.hasOpenApproval()).toBe(false);
        const settled = getResponseActivity(pending?.id ?? '');
        expect(settled?.status).toBe('completed');
        expect(lastProjectedStep()).toMatchObject({ kind: 'approval', status: 'completed' });
    });

    it('keeps repeated identical approval prompts as separate FIFO activities', () => {
        const recorder = createGatewayActivityRecorder(context);
        const approval = {
            command: 'rm -rf build',
            description: 'Dangerous delete',
            pattern_key: 'rm -rf',
            pattern_keys: ['rm -rf'],
        };

        recorder.recordApproval(approval);
        recorder.recordApproval(approval);

        const approvals = projectedSteps().filter((step) => step.kind === 'approval');
        expect(approvals).toHaveLength(2);
        expect(approvals[0]?.id).not.toBe(approvals[1]?.id);

        recorder.settleOldestApproval();
        expect(getResponseActivity(approvals[0]?.id ?? '')?.status).toBe('completed');
        expect(getResponseActivity(approvals[1]?.id ?? '')?.status).toBe('running');

        recorder.settleOldestApproval();
        expect(getResponseActivity(approvals[1]?.id ?? '')?.status).toBe('completed');
    });

    it('settles every queued approval after an approve-all response resumes', () => {
        const recorder = createGatewayActivityRecorder(context);
        const approval = {
            command: 'rm -rf build',
            description: 'Dangerous delete',
            pattern_key: 'rm -rf',
            pattern_keys: ['rm -rf'],
        };

        recorder.recordApproval(approval);
        recorder.recordApproval(approval);

        const approvals = projectedSteps().filter((step) => step.kind === 'approval');
        recorder.settleOpenApprovals();

        expect(getResponseActivity(approvals[0]?.id ?? '')?.status).toBe('completed');
        expect(getResponseActivity(approvals[1]?.id ?? '')?.status).toBe('completed');
        expect(recorder.hasOpenApproval()).toBe(false);
    });

    it('records and settles a pending clarification prompt', () => {
        const recorder = createGatewayActivityRecorder(context);

        expect(recorder.hasOpenClarification()).toBe(false);
        recorder.recordClarification({
            choices: ['Los Angeles', 'San Francisco'],
            deadline_at: '2026-06-12T16:00:00.000Z',
            question: 'Which part of California?',
            request_id: 'clarify_1',
        });

        expect(recorder.hasOpenClarification()).toBe(true);
        const pending = findActivityByEvent('clarify.request');
        expect(pending).toMatchObject({
            detail: 'Which part of California?',
            kind: 'custom',
            status: 'running',
            title: 'Clarification',
        });
        expect(pending?.metadata.clarification).toMatchObject({
            choices: ['Los Angeles', 'San Francisco'],
            deadlineAt: '2026-06-12T16:00:00.000Z',
            question: 'Which part of California?',
            requestId: 'clarify_1',
        });
        expect(lastProjectedStep()).toMatchObject({
            clarification: {
                choices: ['Los Angeles', 'San Francisco'],
                question: 'Which part of California?',
                requestId: 'clarify_1',
            },
            kind: 'tool',
            status: 'active',
            toolName: 'clarify',
        });

        expect(
            recorder.settleClarification('clarify_1', {
                answer: 'San Francisco',
                disposition: 'answered',
            })
        ).toBe(true);
        expect(recorder.hasOpenClarification()).toBe(false);
        const settled = getResponseActivity(pending?.id ?? '');
        expect(settled?.status).toBe('completed');
        expect(settled?.metadata.clarification).toMatchObject({
            answer: 'San Francisco',
            disposition: 'answered',
        });
        expect(lastProjectedStep()).toMatchObject({
            clarification: {
                answer: 'San Francisco',
                disposition: 'answered',
            },
            status: 'completed',
        });
    });
});

function findActivityByEvent(event: string) {
    const steps = projectedSteps();
    const step = steps.at(-1);
    const activity = step ? getResponseActivity(step.id) : null;

    if (activity?.metadata.event === event) {
        return activity;
    }

    for (const candidate of steps) {
        const candidateActivity = getResponseActivity(candidate.id);
        if (candidateActivity?.metadata.event === event) {
            return candidateActivity;
        }
    }

    return activity;
}

function projectedSteps() {
    return listProjectedTavernRuntimeEvents()
        .map((entry) => entry.event)
        .flatMap((event) => (event.type === 'turn.progress' ? [event.step] : []));
}

function lastProjectedStep() {
    return projectedSteps().at(-1);
}
