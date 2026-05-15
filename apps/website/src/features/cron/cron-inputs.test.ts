import assert from 'node:assert/strict';
import test from 'node:test';
import type { CronFormState } from './cron-form.ts';
import { buildCronCreateInput, buildCronUpdateInput } from './cron-inputs.ts';

function createBaseState(): CronFormState {
    return {
        agentId: 'flicker',
        at: '',
        cronExpr: '0 7 * * *',
        cronTz: 'America/New_York',
        deliveryChatId: '',
        description: 'Morning brief',
        enabled: true,
        everyMs: '',
        message: 'Summarize updates.',
        name: 'Morning brief',
        runType: 'agentTurn',
        scheduleDayOfWeek: '1',
        scheduleKind: 'daily',
        scheduleTime: '07:00',
        systemEventText: '',
    };
}

test('buildCronCreateInput maps agent turns to isolated cron sessions', () => {
    const input = buildCronCreateInput(createBaseState());

    assert.deepEqual(input, {
        agentId: 'flicker',
        deleteAfterRun: false,
        description: 'Morning brief',
        enabled: true,
        name: 'Morning brief',
        payload: {
            kind: 'agentTurn',
            message: 'Summarize updates.',
        },
        scheduleConfig: {
            kind: 'daily',
            time: '07:00',
            tz: 'America/New_York',
        },
        wakeMode: 'now',
    });
});

test('buildCronCreateInput maps system events to main delivery jobs without an agent', () => {
    const input = buildCronCreateInput({
        ...createBaseState(),
        agentId: '',
        deliveryChatId: 'discord:channel:123',
        message: '',
        runType: 'systemEvent',
        systemEventText: 'Post the daily status.',
    });

    assert.deepEqual(input, {
        agentId: undefined,
        deleteAfterRun: false,
        delivery: {
            chatId: 'discord:channel:123',
        },
        description: 'Morning brief',
        enabled: true,
        name: 'Morning brief',
        payload: {
            kind: 'systemEvent',
            text: 'Post the daily status.',
        },
        scheduleConfig: {
            kind: 'daily',
            time: '07:00',
            tz: 'America/New_York',
        },
        wakeMode: 'now',
    });
});

test('buildCronUpdateInput clears the agent when switching to a system event', () => {
    const input = buildCronUpdateInput('job-123', {
        ...createBaseState(),
        agentId: '',
        runType: 'systemEvent',
        systemEventText: 'No prompt run',
    });

    assert.deepEqual(input, {
        jobId: 'job-123',
        patch: {
            agentId: null,
            deleteAfterRun: false,
            delivery: null,
            description: 'Morning brief',
            enabled: true,
            name: 'Morning brief',
            payload: {
                kind: 'systemEvent',
                text: 'No prompt run',
            },
            scheduleConfig: {
                kind: 'daily',
                time: '07:00',
                tz: 'America/New_York',
            },
            wakeMode: 'now',
        },
    });
});
