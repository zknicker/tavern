import { describe, expect, test } from 'bun:test';
import type { AgentRuntimeConnectionOutput } from '../../lib/trpc.tsx';
import { getTavernUpdateStatus } from './use-tavern-update.ts';

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
            phase: 'available',
            version: '1.2.3',
        });
    });
});

function createRuntimeConnection(): AgentRuntimeConnectionOutput {
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
    };
}
