import { describe, expect, test } from 'bun:test';
import type { AgentRuntimeConnectionOutput } from '../../lib/trpc.tsx';
import { getRuntimeUpdateDesktopAction, getTavernUpdateStatus } from './use-tavern-update.ts';

describe('Tavern update status', () => {
    test('surfaces app update requirement when Runtime is newer than Tavern', () => {
        const status = getTavernUpdateStatus({
            appNeedsUpdate: true,
            desktopUpdateStatus: { phase: 'current' },
            finalRestartPhase: 'idle',
            isRuntimeDisconnected: false,
            needsRuntimeUpdate: false,
            runtimeConnection: createRuntimeConnection(),
            runtimeUpdateError: null,
            runtimeUpdateStatus: null,
        });

        expect(status).toMatchObject({
            phase: 'app-update-required',
        });
    });

    test('uses available app update when Runtime requires a newer Tavern', () => {
        const status = getTavernUpdateStatus({
            appNeedsUpdate: true,
            desktopUpdateStatus: { phase: 'available', version: '1.2.3' },
            finalRestartPhase: 'idle',
            isRuntimeDisconnected: false,
            needsRuntimeUpdate: false,
            runtimeConnection: createRuntimeConnection(),
            runtimeUpdateError: null,
            runtimeUpdateStatus: null,
        });

        expect(status).toMatchObject({
            detail: 'Tavern v1.2.3 is ready to download.',
            phase: 'available',
            version: '1.2.3',
        });
    });

    test('explains when Tavern is ready to install and restart', () => {
        const status = getTavernUpdateStatus({
            appNeedsUpdate: false,
            desktopUpdateStatus: { phase: 'ready', version: '1.2.5' },
            finalRestartPhase: 'idle',
            isRuntimeDisconnected: false,
            needsRuntimeUpdate: false,
            runtimeConnection: createRuntimeConnection(),
            runtimeUpdateError: null,
            runtimeUpdateStatus: null,
        });

        expect(status).toMatchObject({
            detail: 'Tavern v1.2.5 is ready. Click to install and restart.',
            phase: 'ready',
            version: '1.2.5',
        });
    });

    test('explains when Runtime is ready to update', () => {
        const status = getTavernUpdateStatus({
            appNeedsUpdate: false,
            desktopUpdateStatus: { phase: 'current' },
            finalRestartPhase: 'idle',
            isRuntimeDisconnected: false,
            needsRuntimeUpdate: true,
            runtimeConnection: createRuntimeConnection({
                requiredRuntimeVersion: '1.2.4',
            }),
            runtimeUpdateError: null,
            runtimeUpdateStatus: null,
        });

        expect(status).toMatchObject({
            detail: 'The Tavern Runtime is ready to update to v1.2.4. Click to download.',
            phase: 'available',
            version: '1.2.4',
        });
    });

    test('explains when Runtime is ready to restart', () => {
        const status = getTavernUpdateStatus({
            appNeedsUpdate: false,
            desktopUpdateStatus: { phase: 'current' },
            finalRestartPhase: 'idle',
            isRuntimeDisconnected: false,
            needsRuntimeUpdate: true,
            runtimeConnection: createRuntimeConnection({
                requiredRuntimeVersion: '1.2.4',
            }),
            runtimeUpdateError: null,
            runtimeUpdateStatus: {
                currentVersion: '1.2.3',
                message: null,
                phase: 'staged',
                targetVersion: '1.2.4',
            },
        });

        expect(status).toMatchObject({
            detail: 'Tavern Runtime v1.2.4 is ready. Click to restart runtime.',
            phase: 'ready',
            version: '1.2.4',
        });
    });

    test('shows app download progress as soon as the user requests an update', () => {
        const status = getTavernUpdateStatus({
            appNeedsUpdate: false,
            desktopUpdateStatus: { phase: 'available', version: '1.2.5' },
            finalRestartPhase: 'idle',
            isRuntimeDisconnected: false,
            needsRuntimeUpdate: false,
            pendingAction: 'download-app',
            runtimeConnection: createRuntimeConnection(),
            runtimeUpdateError: null,
            runtimeUpdateStatus: null,
        });

        expect(status).toMatchObject({
            phase: 'downloading-app',
            progress: 0,
            version: '1.2.5',
        });
    });

    test('shows Runtime staging as soon as the user requests a Runtime update', () => {
        const status = getTavernUpdateStatus({
            appNeedsUpdate: false,
            desktopUpdateStatus: { phase: 'current' },
            finalRestartPhase: 'idle',
            isRuntimeDisconnected: false,
            needsRuntimeUpdate: true,
            pendingAction: 'stage-runtime',
            runtimeConnection: createRuntimeConnection({
                requiredRuntimeVersion: '1.2.4',
            }),
            runtimeUpdateError: null,
            runtimeUpdateStatus: null,
        });

        expect(status).toMatchObject({
            phase: 'staging-runtime',
            version: '1.2.4',
        });
    });

    test('does not run the desktop updater for runtime-only updates', () => {
        expect(getRuntimeUpdateDesktopAction({ phase: 'current' })).toBe('none');
    });

    test('downloads app update before runtime restart when one is available', () => {
        expect(getRuntimeUpdateDesktopAction({ phase: 'available', version: '1.2.5' })).toBe(
            'download-app-before-runtime-restart'
        );
    });

    test('restarts app after runtime restart when app update is ready', () => {
        expect(getRuntimeUpdateDesktopAction({ phase: 'ready', version: '1.2.5' })).toBe(
            'restart-app-after-runtime-restart'
        );
    });
});

function createRuntimeConnection(
    patch: Partial<AgentRuntimeConnectionOutput> = {}
): AgentRuntimeConnectionOutput {
    return {
        appVersion: '1.2.2',
        authConfigured: false,
        baseUrl: 'http://127.0.0.1:18790',
        capabilities: [],
        enabled: true,
        id: 'runtime',
        isActive: true,
        lastCheckedAt: null,
        lastError: null,
        lastSyncedAt: null,
        name: 'Tavern Runtime',
        requiredRuntimeVersion: '1.2.2',
        runtimeCapabilities: [],
        runtimeVersion: '1.2.3',
        source: 'saved',
        versionStatus: 'mismatched',
        ...patch,
    };
}
