import { describe, expect, test } from 'bun:test';
import { getUpdateStatusMessage } from './page.tsx';

describe('update settings status message', () => {
    test('hides idle status before the user checks for updates', () => {
        expect(
            getUpdateStatusMessage(
                {
                    detail: 'Tavern is up to date.',
                    phase: 'idle',
                },
                false
            )
        ).toBeNull();
    });

    test('shows a green up-to-date result after checking', () => {
        expect(
            getUpdateStatusMessage(
                {
                    detail: 'Tavern is up to date.',
                    phase: 'idle',
                },
                true
            )
        ).toEqual({
            detail: 'Up to date',
            tone: 'success',
        });
    });

    test('shows an available update as an error-tone result', () => {
        expect(
            getUpdateStatusMessage(
                {
                    detail: 'Tavern 1.2.4 is available.',
                    phase: 'available',
                    version: '1.2.4',
                },
                true
            )
        ).toEqual({
            detail: 'Tavern 1.2.4 is available.',
            tone: 'error',
        });
    });
});
