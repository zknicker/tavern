// Reminder cadence grammar (D4, Raft parity): `every:15m` / `every:2h` /
// `every:1d`, `daily@09:00`, `weekly:mon,fri@09:00`. Wall-clock cadences
// resolve in the home timezone.

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export type ReminderCadence =
    | { everyMs: number; kind: 'every' }
    | { hour: number; kind: 'daily'; minute: number }
    | { days: number[]; hour: number; kind: 'weekly'; minute: number };

export function parseCadence(spec: string): ReminderCadence | null {
    const every = /^every:(\d+)([mhd])$/u.exec(spec);
    if (every?.[1] && every[2]) {
        const amount = Number(every[1]);
        if (amount < 1) {
            return null;
        }
        const unitMs = every[2] === 'm' ? 60_000 : every[2] === 'h' ? 3_600_000 : 86_400_000;
        return { everyMs: amount * unitMs, kind: 'every' };
    }
    const daily = /^daily@(\d{2}):(\d{2})$/u.exec(spec);
    if (daily?.[1] && daily[2]) {
        const time = parseTime(daily[1], daily[2]);
        return time ? { hour: time.hour, kind: 'daily', minute: time.minute } : null;
    }
    const weekly = /^weekly:([a-z,]+)@(\d{2}):(\d{2})$/u.exec(spec);
    if (weekly?.[1] && weekly[2] && weekly[3]) {
        const time = parseTime(weekly[2], weekly[3]);
        if (!time) {
            return null;
        }
        const days = [
            ...new Set(
                weekly[1]
                    .split(',')
                    .map((token) => WEEKDAYS.indexOf(token as (typeof WEEKDAYS)[number]))
            ),
        ].sort((a, b) => a - b);
        if (days.length === 0 || days.includes(-1)) {
            return null;
        }
        return { days, hour: time.hour, kind: 'weekly', minute: time.minute };
    }
    return null;
}

/** Parse a snooze duration: `30m`, `2h`, `1d`. */
export function parseSnoozeDuration(value: string): number | null {
    const match = /^(\d+)([mhd])$/u.exec(value);
    if (!(match?.[1] && match[2])) {
        return null;
    }
    const amount = Number(match[1]);
    if (amount < 1) {
        return null;
    }
    const unitMs = match[2] === 'm' ? 60_000 : match[2] === 'h' ? 3_600_000 : 86_400_000;
    return amount * unitMs;
}

/** The next fire strictly after `afterMs`, in `timezone` for wall-clock cadences. */
export function nextFireAtMs(cadence: ReminderCadence, afterMs: number, timezone: string): number {
    if (cadence.kind === 'every') {
        return afterMs + cadence.everyMs;
    }
    const days = cadence.kind === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : cadence.days;
    const local = wallClockParts(new Date(afterMs), timezone);
    // Calendar dates, not fixed epochs: DST changes the length of a local day.
    for (let offset = 0; offset <= 8; offset++) {
        const date = new Date(Date.UTC(local.year, local.month - 1, local.day + offset));
        if (!days.includes(date.getUTCDay())) {
            continue;
        }
        const candidate = epochForWallClock(
            {
                day: date.getUTCDate(),
                hour: cadence.hour,
                minute: cadence.minute,
                month: date.getUTCMonth() + 1,
                year: date.getUTCFullYear(),
            },
            timezone
        );
        if (candidate > afterMs) {
            return candidate;
        }
    }
    // Unreachable for a valid cadence; fall back to a day later.
    return afterMs + 86_400_000;
}

function parseTime(hourText: string, minuteText: string): { hour: number; minute: number } | null {
    const hour = Number(hourText);
    const minute = Number(minuteText);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        return null;
    }
    return { hour, minute };
}

function wallClockParts(date: Date, timezone: string) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        hour: '2-digit',
        hour12: false,
        minute: '2-digit',
        month: '2-digit',
        timeZone: timezone,
        weekday: 'short',
        year: 'numeric',
    });
    const parts = new Map(
        formatter.formatToParts(date).map((part) => [part.type, part.value] as const)
    );
    return {
        day: Number(parts.get('day')),
        hour: Number(parts.get('hour')),
        minute: Number(parts.get('minute')),
        month: Number(parts.get('month')),
        weekday: WEEKDAYS.indexOf(
            (parts.get('weekday') ?? '').slice(0, 3).toLowerCase() as (typeof WEEKDAYS)[number]
        ),
        year: Number(parts.get('year')),
    };
}

/**
 * Epoch ms for a wall-clock time in a timezone. Two-pass offset estimation:
 * assume UTC, read back the zone's rendering, correct by the difference.
 */
function epochForWallClock(
    target: { day: number; hour: number; minute: number; month: number; year: number },
    timezone: string
): number {
    let guess = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute);
    for (let pass = 0; pass < 2; pass++) {
        const seen = wallClockParts(new Date(guess), timezone);
        const seenUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute);
        const wantUtc = Date.UTC(
            target.year,
            target.month - 1,
            target.day,
            target.hour,
            target.minute
        );
        const diff = wantUtc - seenUtc;
        if (diff === 0) {
            return guess;
        }
        guess += diff;
    }
    return guess;
}
