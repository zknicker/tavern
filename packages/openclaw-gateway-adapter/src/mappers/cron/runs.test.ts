import { describe, expect, it } from 'bun:test';
import { mapOpenClawCronRuns } from './runs.ts';

describe('OpenClaw cron run mapping', () => {
    it('maps scheduled run history from OpenClaw run timestamps', () => {
        const mapped = mapOpenClawCronRuns({
            entries: [
                {
                    action: 'finished',
                    deliveryStatus: 'delivered',
                    durationMs: 21_649,
                    jobId: 'etsy',
                    runAtMs: 1_777_813_200_013,
                    sessionId: '39e6406f-9730-43d5-8973-0f575f36dbc4',
                    sessionKey: 'agent:tiny:cron:etsy:run:39e6406f-9730-43d5-8973-0f575f36dbc4',
                    status: 'ok',
                    summary: 'Etsy daily check-in.',
                    ts: 1_777_813_237_533,
                },
            ],
        });

        expect(mapped.runs[0]).toMatchObject({
            deliveryStatus: 'delivered',
            finishedAt: '2026-05-03T13:00:37.533Z',
            id: 'agent:tiny:cron:etsy:run:39e6406f-9730-43d5-8973-0f575f36dbc4',
            jobId: 'etsy',
            scheduledFor: '2026-05-03T13:00:00.013Z',
            startedAt: '2026-05-03T13:00:00.013Z',
            status: 'success',
            summary: 'Etsy daily check-in.',
            trigger: 'schedule',
        });
    });

    it('uses the scheduled run natural key when OpenClaw omits a run/session id', () => {
        const mapped = mapOpenClawCronRuns({
            entries: [
                {
                    action: 'finished',
                    deliveryStatus: 'delivered',
                    jobId: 'd3292360-3ce0-4331-a917-e7eaba948886',
                    runAtMs: 1_777_813_200_013,
                    status: 'ok',
                    ts: 1_777_813_237_533,
                },
            ],
        });

        expect(mapped.runs[0]?.id).toBe(
            'cron:d3292360-3ce0-4331-a917-e7eaba948886:schedule:2026-05-03T13:00:00.013Z'
        );
    });
});
