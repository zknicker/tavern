import { describe, expect, test } from 'bun:test';
import type { AgentRuntimeConnectionOutput } from '../../lib/trpc.tsx';
import {
    formatCapabilityDisabledReason,
    getCapability,
    settingsCapabilityRequirements,
} from './use-capability.ts';

describe('Runtime capability gates', () => {
    test('blocks Runtime-backed gates when the Runtime version contract is mismatched', () => {
        const capability = getCapability(
            createRuntimeConnection({
                runtimeVersion: '1.2.1',
                versionStatus: 'mismatched',
            }),
            ['status', 'chats', 'messages']
        );

        expect(capability.healthy).toBe(false);
        expect(formatCapabilityDisabledReason(capability)).toBe('Tavern Runtime update required.');
    });

    test('names Tavern as the required update when Runtime is newer than the app', () => {
        const capability = getCapability(
            createRuntimeConnection({
                requiredRuntimeVersion: '1.2.2',
                runtimeVersion: '1.2.3',
                versionStatus: 'mismatched',
            }),
            ['status', 'chats', 'messages']
        );

        expect(capability.healthy).toBe(false);
        expect(formatCapabilityDisabledReason(capability)).toBe('Tavern update required.');
    });

    test('keeps Memories settings reachable when the embedding model is degraded', () => {
        expect(settingsCapabilityRequirements.memories).not.toContain('embeddingModel');
    });
});

function createRuntimeConnection(
    overrides: Partial<NonNullable<AgentRuntimeConnectionOutput>> = {}
): AgentRuntimeConnectionOutput {
    return {
        appVersion: '1.2.2',
        authConfigured: false,
        baseUrl: 'http://127.0.0.1:18790',
        capabilities: [
            createCapability('status'),
            createCapability('chats'),
            createCapability('messages'),
        ],
        enabled: true,
        id: 'runtime',
        isActive: true,
        lastCheckedAt: null,
        lastError: null,
        lastSyncedAt: null,
        name: 'Tavern Runtime',
        requiredRuntimeVersion: '1.2.2',
        runtimeCapabilities: [
            createCapability('status'),
            createCapability('chats'),
            createCapability('messages'),
        ],
        runtimeVersion: '1.2.1',
        source: 'saved',
        versionStatus: 'compatible',
        ...overrides,
    };
}

function createCapability(
    capability: NonNullable<AgentRuntimeConnectionOutput>['runtimeCapabilities'][number]['capability']
): NonNullable<AgentRuntimeConnectionOutput>['runtimeCapabilities'][number] {
    return {
        capability,
        checkedAt: '2026-06-03T00:00:00.000Z',
        errorCode: null,
        lastHealthyAt: '2026-06-03T00:00:00.000Z',
        metadataJson: '{}',
        method: 'runtime.capabilities',
        reason: null,
        runtimeId: 'runtime',
        state: 'healthy',
        technicalMessage: null,
        updatedAt: '2026-06-03T00:00:00.000Z',
    };
}
