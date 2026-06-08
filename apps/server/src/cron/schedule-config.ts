import { z } from 'zod';

const timeOfDaySchema = z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must use HH:mm format.');

const timezoneSchema = z.string().trim().min(1).optional();

export const cronScheduleConfigSchema = z.discriminatedUnion('kind', [
    z.object({
        everyMs: z.number().int().positive(),
        kind: z.literal('interval'),
    }),
    z.object({
        kind: z.literal('daily'),
        time: timeOfDaySchema,
        tz: timezoneSchema,
    }),
    z.object({
        kind: z.literal('weekdays'),
        time: timeOfDaySchema,
        tz: timezoneSchema,
    }),
    z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        kind: z.literal('weekly'),
        time: timeOfDaySchema,
        tz: timezoneSchema,
    }),
    z.object({
        expr: z.string().trim().min(1),
        kind: z.literal('custom'),
        tz: timezoneSchema,
    }),
]);

export type CronScheduleConfig = z.infer<typeof cronScheduleConfigSchema>;

export type HermesCronSchedule =
    | {
          everyMs: number;
          kind: 'every';
      }
    | {
          expr: string;
          kind: 'cron';
          tz?: string;
      };

export function buildHermesCronSchedule(config: CronScheduleConfig): HermesCronSchedule {
    switch (config.kind) {
        case 'interval':
            return {
                everyMs: config.everyMs,
                kind: 'every',
            };
        case 'daily':
            return buildCronSchedule(config.time, '*', config.tz);
        case 'weekdays':
            return buildCronSchedule(config.time, '1-5', config.tz);
        case 'weekly':
            return buildCronSchedule(config.time, String(config.dayOfWeek), config.tz);
        case 'custom':
            return withTimezone(
                {
                    expr: config.expr.trim(),
                    kind: 'cron' as const,
                },
                config.tz
            );
    }
}

function buildCronSchedule(time: string, dayOfWeek: string, tz: string | undefined) {
    const [hour = '0', minute = '0'] = time.split(':');

    return withTimezone(
        {
            expr: `${Number(minute)} ${Number(hour)} * * ${dayOfWeek}`,
            kind: 'cron' as const,
        },
        tz
    );
}

function withTimezone<T extends HermesCronSchedule>(schedule: T, tz: string | undefined): T {
    const trimmedTimezone = tz?.trim();

    if (!trimmedTimezone || schedule.kind !== 'cron') {
        return schedule;
    }

    return {
        ...schedule,
        tz: trimmedTimezone,
    };
}
