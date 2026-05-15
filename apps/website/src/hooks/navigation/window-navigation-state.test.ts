import { describe, expect, test } from 'bun:test';
import {
    applyWindowNavigationHistoryChange,
    createWindowNavigationHistoryState,
} from './window-navigation-state.ts';

describe('window navigation state', () => {
    test('creates an initial history entry', () => {
        expect(createWindowNavigationHistoryState('overview')).toEqual({
            entries: ['overview'],
            index: 0,
        });
    });

    test('push adds a new entry and advances the index', () => {
        const state = applyWindowNavigationHistoryChange(
            createWindowNavigationHistoryState('overview'),
            {
                key: 'chats',
                navigationType: 'PUSH',
            }
        );

        expect(state).toEqual({
            entries: ['overview', 'chats'],
            index: 1,
        });
    });

    test('push truncates any forward history', () => {
        const state = applyWindowNavigationHistoryChange(
            {
                entries: ['overview', 'chats', 'memories'],
                index: 1,
            },
            {
                key: 'jobs',
                navigationType: 'PUSH',
            }
        );

        expect(state).toEqual({
            entries: ['overview', 'chats', 'jobs'],
            index: 2,
        });
    });

    test('replace swaps the current entry in place', () => {
        const state = applyWindowNavigationHistoryChange(
            {
                entries: ['overview', 'chats'],
                index: 1,
            },
            {
                key: 'sessions',
                navigationType: 'REPLACE',
            }
        );

        expect(state).toEqual({
            entries: ['overview', 'sessions'],
            index: 1,
        });
    });

    test('pop moves to an existing entry without rewriting history', () => {
        const state = applyWindowNavigationHistoryChange(
            {
                entries: ['overview', 'chats', 'jobs'],
                index: 2,
            },
            {
                key: 'chats',
                navigationType: 'POP',
            }
        );

        expect(state).toEqual({
            entries: ['overview', 'chats', 'jobs'],
            index: 1,
        });
    });

    test('pop falls back to appending unknown entries', () => {
        const state = applyWindowNavigationHistoryChange(
            {
                entries: ['overview', 'chats'],
                index: 1,
            },
            {
                key: 'external',
                navigationType: 'POP',
            }
        );

        expect(state).toEqual({
            entries: ['overview', 'chats', 'external'],
            index: 2,
        });
    });
});
