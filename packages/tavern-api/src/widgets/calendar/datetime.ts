const dateTimePattern = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/u;
const explicitOffsetPattern = /(?:z|[+-]\d{2}:?\d{2})$/iu;

export const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/u;
export const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;

export function isCalendarDate(value: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);

    if (!match) {
        return false;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    );
}

export function minutes(value: string) {
    const [hour = '0', minute = '0'] = value.split(':');
    return Number(hour) * 60 + Number(minute);
}

export function nextCalendarDate(value: string) {
    const [year = '0', month = '0', day = '0'] = value.split('-');
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day) + 1));
    return date.toISOString().slice(0, 10);
}

export function dateTimeParts(value: string | undefined, timezone?: string) {
    if (!value) {
        return null;
    }

    const trimmed = value.trim();
    const direct = dateTimePattern.exec(trimmed);

    if (!direct) {
        return null;
    }

    const [, date, time] = direct;

    if (!(isCalendarDate(date) && timePattern.test(time))) {
        return null;
    }

    if (timezone && isValidTimeZone(timezone) && explicitOffsetPattern.test(trimmed)) {
        const parsed = new Date(trimmed);

        if (Number.isFinite(parsed.getTime())) {
            return dateTimePartsInTimeZone(parsed, timezone);
        }
    }

    return { date, time };
}

function dateTimePartsInTimeZone(date: Date, timezone: string) {
    const parts = new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        hour: '2-digit',
        hourCycle: 'h23',
        minute: '2-digit',
        month: '2-digit',
        timeZone: timezone,
        year: 'numeric',
    }).formatToParts(date);
    const value = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((part) => part.type === type)?.value ?? '';
    const day = value('day');
    const hour = value('hour');
    const minute = value('minute');
    const month = value('month');
    const year = value('year');

    if (!(year && month && day && hour && minute)) {
        return null;
    }

    return { date: `${year}-${month}-${day}`, time: `${hour}:${minute}` };
}

function isValidTimeZone(value: string) {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date(0));
        return true;
    } catch {
        return false;
    }
}
