import { describe, expect, test } from 'bun:test';
import type { TavernUpdateStatus } from './use-tavern-update.ts';
import { getSidebarUpdateLabel } from './use-tavern-update-indicator.ts';

describe('sidebar update labels', () => {
    test('uses user-facing labels for update states', () => {
        const cases: [TavernUpdateStatus, string][] = [
            [
                {
                    detail: 'Tavern v1.4.30 is ready to download.',
                    phase: 'available',
                    version: '1.4.30',
                },
                'Update Available',
            ],
            [
                {
                    detail: 'Downloading Tavern v1.4.30.',
                    phase: 'downloading-app',
                    progress: 0.42,
                    version: '1.4.30',
                },
                'Update In Progress',
            ],
            [
                {
                    detail: 'Restarting Tavern.',
                    phase: 'restarting-app',
                    version: '1.4.30',
                },
                'Restarting...',
            ],
            [
                { detail: 'Tavern v1.4.30 is ready.', phase: 'ready', version: '1.4.30' },
                'Ready to Install',
            ],
            [{ detail: 'Tavern could not install the update.', phase: 'failed' }, 'Update Failed'],
        ];

        for (const [status, label] of cases) {
            expect(getSidebarUpdateLabel(status)).toBe(label);
        }
    });
});
