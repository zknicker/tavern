import { describe, expect, it } from 'bun:test';
import { mapOpenClawCron } from './get.ts';
import { mapOpenClawCronList } from './list.ts';

describe('OpenClaw cron mapping', () => {
    it('maps OpenClaw jobs into Tavern cron summaries', () => {
        const mapped = mapOpenClawCronList({
            jobs: [
                {
                    agentId: 'ops',
                    enabled: true,
                    id: 'morning',
                    name: 'Morning brief',
                    nextRunAtMs: 1_777_647_600_000,
                    schedule: {
                        expr: '0 7 * * *',
                        kind: 'cron',
                        tz: 'America/New_York',
                    },
                    updatedAtMs: 1_777_608_000_000,
                },
            ],
        });

        expect(mapped.jobs[0]).toMatchObject({
            agentId: 'ops',
            enabled: true,
            id: 'morning',
            name: 'Morning brief',
            schedule: {
                expr: '0 7 * * *',
                kind: 'cron',
                tz: 'America/New_York',
            },
        });
    });

    it('maps OpenClaw cron details without dropping nested payload and delivery', () => {
        const mapped = mapOpenClawCron({
            agentId: 'tiny',
            createdAtMs: 1_770_322_500_377,
            delivery: {
                channel: 'discord',
                mode: 'announce',
                to: 'channel:1458323781125668958',
            },
            enabled: true,
            id: 'etsy',
            name: 'Etsy Daily Check-In',
            payload: {
                kind: 'agentTurn',
                message: 'Run the Etsy daily check-in.',
                timeoutSeconds: 120,
            },
            schedule: {
                expr: '0 9 * * *',
                kind: 'cron',
                tz: 'America/New_York',
            },
            state: {
                lastDeliveryStatus: 'delivered',
                lastRunStatus: 'ok',
                nextRunAtMs: 1_777_899_600_000,
            },
            updatedAtMs: 1_777_813_221_662,
            wakeMode: 'next-heartbeat',
        });

        expect(mapped).toMatchObject({
            delivery: {
                chatId: 'discord:channel:1458323781125668958',
            },
            payload: {
                kind: 'agentTurn',
                message: 'Run the Etsy daily check-in.',
                timeoutSeconds: 120,
            },
            schedule: {
                expr: '0 9 * * *',
                kind: 'cron',
                tz: 'America/New_York',
            },
            state: {
                lastDeliveryStatus: 'delivered',
                lastRunStatus: 'success',
                nextRunAtMs: 1_777_899_600_000,
            },
            wakeMode: 'next-heartbeat',
        });
    });
});
