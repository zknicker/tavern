/**
 * Check whether a timezone string is a valid IANA identifier
 * that Intl.DateTimeFormat can use.
 */
export function isValidTimezone(tz: string): boolean {
    try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}

/**
 * Return the given timezone if valid IANA, otherwise fall back to UTC.
 */
export function resolveTimezone(tz: string): string {
    return isValidTimezone(tz) ? tz : 'UTC';
}

/**
 * Format an instant as a local ISO timestamp with UTC offset, e.g.
 * `2026-07-05T13:22:42-04:00`. Falls back to UTC if the timezone is invalid.
 */
export function formatLocalIsoWithOffset(date: Date, timezone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
        day: '2-digit',
        hour: '2-digit',
        hourCycle: 'h23',
        minute: '2-digit',
        month: '2-digit',
        second: '2-digit',
        timeZone: resolveTimezone(timezone),
        timeZoneName: 'longOffset',
        year: 'numeric',
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((candidate) => candidate.type === type)?.value ?? '';
    const rawOffset = part('timeZoneName');
    const offset = rawOffset === 'GMT' ? '+00:00' : rawOffset.replace('GMT', '');
    return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}${offset}`;
}

/**
 * Format an instant as the local calendar date (`YYYY-MM-DD`) in the given
 * timezone. Falls back to UTC if the timezone is invalid.
 */
export function formatLocalDateSlug(date: Date, timezone: string): string {
    return formatLocalIsoWithOffset(date, timezone).slice(0, 10);
}

/**
 * Convert a UTC ISO timestamp to a localized display string.
 * Uses the Intl API (no external dependencies).
 * Falls back to UTC if the timezone is invalid.
 */
export function formatLocalTime(utcIso: string, timezone: string): string {
    const date = new Date(utcIso);
    return date.toLocaleString('en-US', {
        timeZone: resolveTimezone(timezone),
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
}
