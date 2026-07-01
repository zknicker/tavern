import { describe, expect, test } from 'bun:test';
import { getAppLayoutModeSnapshot } from './use-app-layout-preference.ts';

describe('app layout preference', () => {
    test('uses topbar tabs when no layout preference is stored', () => {
        const { restore } = installWindowLocalStorage();

        try {
            expect(getAppLayoutModeSnapshot()).toBe('tabs');
        } finally {
            restore();
        }
    });

    test('keeps an explicit sidebar layout preference', () => {
        const { localStorage, restore } = installWindowLocalStorage();

        try {
            localStorage.setItem('tavern.app.layout.mode.v2', 'sidebar');

            expect(getAppLayoutModeSnapshot()).toBe('sidebar');
        } finally {
            restore();
        }
    });
});

function installWindowLocalStorage() {
    const localStorage = createMemoryLocalStorage();
    const hadWindow = 'window' in globalThis;
    const previousWindow = (globalThis as { window?: unknown }).window;

    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: { localStorage },
        writable: true,
    });

    return {
        localStorage,
        restore: () => {
            if (hadWindow) {
                Object.defineProperty(globalThis, 'window', {
                    configurable: true,
                    value: previousWindow,
                    writable: true,
                });
                return;
            }

            Object.defineProperty(globalThis, 'window', {
                configurable: true,
                value: undefined,
                writable: true,
            });
        },
    };
}

function createMemoryLocalStorage() {
    const values = new Map<string, string>();

    return {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => {
            values.set(key, value);
        },
    };
}
