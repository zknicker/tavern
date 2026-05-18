import { hashAgentRuntimeConfig, toCanonicalAgentRuntimeConfigJson } from '@tavern/api/config';
import { findSyncState, saveSyncState } from '../storage/sync-state.ts';
import type { SyncPrimitiveKind, SyncPrimitiveState, SyncPrimitiveStatus } from './contracts.ts';

interface SavePrimitiveSyncStateInput {
    agentRuntimeConfig: unknown | null;
    attemptedAt: string;
    error: string | null;
    id: string;
    kind: SyncPrimitiveKind;
    localConfig: unknown;
    status: SyncPrimitiveStatus;
    successful: boolean;
}

function buildPrimitiveSyncState(
    input: SavePrimitiveSyncStateInput & {
        existing: SyncPrimitiveState | null;
    }
): SyncPrimitiveState {
    return {
        hash: hashAgentRuntimeConfig(input.localConfig),
        id: input.id,
        json: toCanonicalAgentRuntimeConfigJson(input.localConfig),
        kind: input.kind,
        lastAttemptedAt: input.attemptedAt,
        lastError: input.error,
        lastSuccessfulAt: input.successful
            ? input.attemptedAt
            : (input.existing?.lastSuccessfulAt ?? null),
        agentRuntimeHash: input.agentRuntimeConfig
            ? hashAgentRuntimeConfig(input.agentRuntimeConfig)
            : (input.existing?.agentRuntimeHash ?? null),
        agentRuntimeJson: input.agentRuntimeConfig
            ? toCanonicalAgentRuntimeConfigJson(input.agentRuntimeConfig)
            : (input.existing?.agentRuntimeJson ?? null),
        status: input.status,
        updatedAt: input.attemptedAt,
    };
}

export async function savePrimitiveSyncState(input: SavePrimitiveSyncStateInput) {
    const existing = await findSyncState({
        id: input.id,
        kind: input.kind,
    });
    const state = buildPrimitiveSyncState({
        ...input,
        existing,
    });

    await saveSyncState(state);

    return state;
}
