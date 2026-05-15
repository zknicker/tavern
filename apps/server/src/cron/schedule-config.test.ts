import { describe, expect, test } from 'bun:test';
import { buildOpenClawCronSchedule, cronScheduleConfigSchema } from './schedule-config.ts';

describe('buildOpenClawCronSchedule', () => {
    test('maps interval configs to OpenClaw every schedules', () => {
        expect(
            buildOpenClawCronSchedule({
                everyMs: 300_000,
                kind: 'interval',
            })
        ).toEqual({
            everyMs: 300_000,
            kind: 'every',
        });
    });

    test('maps daily configs to cron expressions', () => {
        expect(
            buildOpenClawCronSchedule({
                kind: 'daily',
                time: '09:15',
                tz: 'America/New_York',
            })
        ).toEqual({
            expr: '15 9 * * *',
            kind: 'cron',
            tz: 'America/New_York',
        });
    });

    test('maps weekday configs to Monday through Friday cron expressions', () => {
        expect(
            buildOpenClawCronSchedule({
                kind: 'weekdays',
                time: '08:00',
            })
        ).toEqual({
            expr: '0 8 * * 1-5',
            kind: 'cron',
        });
    });

    test('maps weekly configs to the selected day and time', () => {
        expect(
            buildOpenClawCronSchedule({
                dayOfWeek: 1,
                kind: 'weekly',
                time: '16:30',
            })
        ).toEqual({
            expr: '30 16 * * 1',
            kind: 'cron',
        });
    });

    test('maps custom configs to trimmed cron expressions', () => {
        expect(
            buildOpenClawCronSchedule({
                expr: '  0 7 * * *  ',
                kind: 'custom',
                tz: 'UTC',
            })
        ).toEqual({
            expr: '0 7 * * *',
            kind: 'cron',
            tz: 'UTC',
        });
    });

    test('rejects invalid time configs', () => {
        expect(() =>
            cronScheduleConfigSchema.parse({
                kind: 'daily',
                time: '25:00',
            })
        ).toThrow();
    });
});
