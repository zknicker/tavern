import { describe, expect, test } from 'bun:test';
import { getSearchConfig, setSearchQuery } from './search-state.ts';

describe('dashboard search state', () => {
    test('returns the expected placeholder for supported routes', () => {
        expect(getSearchConfig('/dashboard/cron')).toEqual({
            placeholder: 'Filter jobs...',
        });
    });

    test('returns null when the route does not support search', () => {
        expect(getSearchConfig('/dashboard/overview')).toBeNull();
        expect(getSearchConfig('/dashboard/settings')).toBeNull();
    });

    test('sets the q param while preserving unrelated params', () => {
        const nextSearchParams = setSearchQuery(
            new URLSearchParams('sessionKey=abc'),
            'agent alpha'
        );

        expect(nextSearchParams.toString()).toBe('sessionKey=abc&q=agent+alpha');
    });

    test('removes the q param when the next query is blank', () => {
        const nextSearchParams = setSearchQuery(
            new URLSearchParams('sessionKey=abc&q=agent+alpha'),
            '   '
        );

        expect(nextSearchParams.toString()).toBe('sessionKey=abc');
    });
});
