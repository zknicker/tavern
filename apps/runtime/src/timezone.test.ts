import { describe, expect, it } from 'vitest';

import {
    formatLocalDateSlug,
    formatLocalIsoWithOffset,
    formatLocalTime,
    formatLocalTimestampWithWeekday,
    isValidTimezone,
    resolveTimezone,
} from './timezone';

describe('formatLocalIsoWithOffset', () => {
    it('renders local wall-clock time with the UTC offset', () => {
        const date = new Date('2026-07-05T17:22:42.000Z');
        expect(formatLocalIsoWithOffset(date, 'America/New_York')).toBe(
            '2026-07-05T13:22:42-04:00'
        );
        expect(formatLocalIsoWithOffset(date, 'Asia/Tokyo')).toBe('2026-07-06T02:22:42+09:00');
    });

    it('renders UTC with a zero offset', () => {
        expect(formatLocalIsoWithOffset(new Date('2026-01-01T00:00:00.000Z'), 'UTC')).toBe(
            '2026-01-01T00:00:00+00:00'
        );
    });

    it('falls back to UTC for invalid timezones', () => {
        expect(formatLocalIsoWithOffset(new Date('2026-01-01T12:00:00.000Z'), 'IST-2')).toBe(
            '2026-01-01T12:00:00+00:00'
        );
    });
});

describe('formatLocalTimestampWithWeekday', () => {
    it('prefixes the local weekday, crossing the date line with the wall clock', () => {
        const date = new Date('2026-07-05T17:22:42.000Z');
        expect(formatLocalTimestampWithWeekday(date, 'America/New_York')).toBe(
            'Sun 2026-07-05T13:22:42-04:00'
        );
        // Tokyo is already Monday at this instant.
        expect(formatLocalTimestampWithWeekday(date, 'Asia/Tokyo')).toBe(
            'Mon 2026-07-06T02:22:42+09:00'
        );
    });

    it('falls back to UTC for invalid timezones', () => {
        expect(formatLocalTimestampWithWeekday(new Date('2026-01-01T12:00:00.000Z'), 'IST-2')).toBe(
            'Thu 2026-01-01T12:00:00+00:00'
        );
    });
});

describe('formatLocalDateSlug', () => {
    it('buckets evening UTC instants into the local day', () => {
        const date = new Date('2026-07-06T01:30:00.000Z');
        expect(formatLocalDateSlug(date, 'America/New_York')).toBe('2026-07-05');
        expect(formatLocalDateSlug(date, 'UTC')).toBe('2026-07-06');
    });
});

// --- formatLocalTime ---

describe('formatLocalTime', () => {
    it('converts UTC to local time display', () => {
        // 2026-02-04T18:30:00Z in America/New_York (EST, UTC-5) = 1:30 PM
        const result = formatLocalTime('2026-02-04T18:30:00.000Z', 'America/New_York');
        expect(result).toContain('1:30');
        expect(result).toContain('PM');
        expect(result).toContain('Feb');
        expect(result).toContain('2026');
    });

    it('handles different timezones', () => {
        // Same UTC time should produce different local times
        const utc = '2026-06-15T12:00:00.000Z';
        const ny = formatLocalTime(utc, 'America/New_York');
        const tokyo = formatLocalTime(utc, 'Asia/Tokyo');
        // NY is UTC-4 in summer (EDT), Tokyo is UTC+9
        expect(ny).toContain('8:00');
        expect(tokyo).toContain('9:00');
    });

    it('does not throw on invalid timezone, falls back to UTC', () => {
        expect(() => formatLocalTime('2026-01-01T00:00:00.000Z', 'IST-2')).not.toThrow();
        const result = formatLocalTime('2026-01-01T12:00:00.000Z', 'IST-2');
        // Should format as UTC (noon UTC = 12:00 PM)
        expect(result).toContain('12:00');
        expect(result).toContain('PM');
    });
});

describe('isValidTimezone', () => {
    it('accepts valid IANA identifiers', () => {
        expect(isValidTimezone('America/New_York')).toBe(true);
        expect(isValidTimezone('UTC')).toBe(true);
        expect(isValidTimezone('Asia/Tokyo')).toBe(true);
        expect(isValidTimezone('Asia/Jerusalem')).toBe(true);
    });

    it('rejects invalid timezone strings', () => {
        expect(isValidTimezone('IST-2')).toBe(false);
        expect(isValidTimezone('XYZ+3')).toBe(false);
    });

    it('rejects empty and garbage strings', () => {
        expect(isValidTimezone('')).toBe(false);
        expect(isValidTimezone('NotATimezone')).toBe(false);
    });
});

describe('resolveTimezone', () => {
    it('returns the timezone if valid', () => {
        expect(resolveTimezone('America/New_York')).toBe('America/New_York');
    });

    it('falls back to UTC for invalid timezone', () => {
        expect(resolveTimezone('IST-2')).toBe('UTC');
        expect(resolveTimezone('')).toBe('UTC');
    });
});
