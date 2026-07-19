import { describe, expect, test } from 'bun:test';
import { getCurrentSessionToken, setCurrentSessionToken } from './session-token-store.ts';

describe('current session token store', () => {
    test('expires the current token after five minutes', () => {
        const realNow = Date.now;
        let now = realNow();
        Date.now = () => now;

        try {
            setCurrentSessionToken('clerk-session-token');
            expect(getCurrentSessionToken()).toBe('clerk-session-token');

            now += 5 * 60 * 1000 + 1;
            expect(getCurrentSessionToken()).toBeNull();
        } finally {
            Date.now = realNow;
        }
    });
});
