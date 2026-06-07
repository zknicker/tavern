import type {
    AgentRuntimeCapabilityHealth,
    AgentRuntimeCapabilityHealthId,
    AgentRuntimeCapabilityHealthState,
} from '@tavern/api';
import { getDb } from '../db/connection';
import { namedParams } from '../db/sqlite';
import { getRuntimeHealth, getRuntimeInfo } from '../tavern/status';
import {
    getExpectedRuntimeCapability,
    getRuntimeCapabilityDefinition,
    type RuntimeCapabilityCheckResult,
    runtimeCapabilityDefinitions,
} from './definitions';
import { publishCapabilityUpdated } from './events';

interface RuntimeCapabilityRow {
    checked_at: string | null;
    display_name: string;
    healthy: number;
    id: AgentRuntimeCapabilityHealthId;
    last_healthy_at: string | null;
    metadata_json: string;
    next_check_at: string | null;
    reason: string | null;
    state: AgentRuntimeCapabilityHealthState;
    technical_message: string | null;
    updated_at: string;
}

export function listRuntimeCapabilities(): AgentRuntimeCapabilityHealth[] {
    const rows = getDb()
        .prepare(
            `SELECT id,
                    display_name,
                    state,
                    healthy,
                    reason,
                    technical_message,
                    metadata_json,
                    checked_at,
                    last_healthy_at,
                    next_check_at,
                    updated_at
             FROM runtime_capabilities`
        )
        .all() as RuntimeCapabilityRow[];
    const byId = new Map(rows.map((row) => [row.id, toCapability(row)] as const));

    return runtimeCapabilityDefinitions
        .map((definition) => byId.get(definition.id) ?? getExpectedRuntimeCapability(definition))
        .sort((left, right) => left.id.localeCompare(right.id));
}

export function getRuntimeCapabilities() {
    return {
        capabilities: listRuntimeCapabilities(),
        health: getRuntimeHealth(),
        info: getRuntimeInfo(),
    };
}

export function getRuntimeCapability(
    id: AgentRuntimeCapabilityHealthId
): AgentRuntimeCapabilityHealth {
    const row = getDb()
        .prepare(
            `SELECT id,
                    display_name,
                    state,
                    healthy,
                    reason,
                    technical_message,
                    metadata_json,
                    checked_at,
                    last_healthy_at,
                    next_check_at,
                    updated_at
             FROM runtime_capabilities
             WHERE id = $id`
        )
        .get(namedParams({ id })) as RuntimeCapabilityRow | null;

    return row
        ? toCapability(row)
        : getExpectedRuntimeCapability(getRuntimeCapabilityDefinition(id));
}

export function isRuntimeCapabilityHealthy(id: AgentRuntimeCapabilityHealthId): boolean {
    return getRuntimeCapability(id).healthy;
}

export async function refreshRuntimeCapabilities(input?: {
    ids?: AgentRuntimeCapabilityHealthId[];
    onlyDue?: boolean;
    publishUpdated?: boolean;
}): Promise<AgentRuntimeCapabilityHealth[]> {
    const ids = input?.ids ?? runtimeCapabilityDefinitions.map((definition) => definition.id);
    const refreshed: AgentRuntimeCapabilityHealth[] = [];
    const previousUpdatedAtById = input?.publishUpdated
        ? new Map(ids.map((id) => [id, getRuntimeCapability(id).updatedAt] as const))
        : null;

    for (const id of ids) {
        const definition = getRuntimeCapabilityDefinition(id);
        if (input?.onlyDue && !isCapabilityDue(id)) {
            refreshed.push(getRuntimeCapability(id));
            continue;
        }
        const result = await definition.check();
        const capability = saveRuntimeCapabilityResult(id, result);
        refreshed.push(capability);
        if (previousUpdatedAtById && previousUpdatedAtById.get(id) !== capability.updatedAt) {
            publishCapabilityUpdated(id);
        }
    }

    return refreshed;
}

export function getCapabilityDisabledReason(ids: AgentRuntimeCapabilityHealthId[]): string | null {
    for (const id of ids) {
        const capability = getRuntimeCapability(id);
        if (!capability.healthy) {
            return `Required capability missing: ${capability.displayName}.`;
        }
    }
    return null;
}

function isCapabilityDue(id: AgentRuntimeCapabilityHealthId) {
    const capability = getRuntimeCapability(id);
    if (!capability.checkedAt) {
        return true;
    }
    if (!capability.nextCheckAt) {
        return false;
    }
    return new Date(capability.nextCheckAt).getTime() <= Date.now();
}

function saveRuntimeCapabilityResult(
    id: AgentRuntimeCapabilityHealthId,
    result: RuntimeCapabilityCheckResult
): AgentRuntimeCapabilityHealth {
    const definition = getRuntimeCapabilityDefinition(id);
    const previous = getRuntimeCapability(id);
    const now = new Date().toISOString();
    const nextCheckAt = new Date(Date.now() + definition.refresh.intervalMs).toISOString();
    const healthy = result.state === 'healthy';
    const row = {
        checkedAt: now,
        displayName: definition.displayName,
        healthy: healthy ? 1 : 0,
        id,
        lastHealthyAt: healthy ? now : previous.lastHealthyAt,
        metadataJson: JSON.stringify(result.metadata ?? {}),
        nextCheckAt,
        reason: healthy ? null : (result.reason ?? `${definition.displayName} is not healthy.`),
        state: result.state,
        technicalMessage: healthy ? null : (result.technicalMessage ?? null),
        updatedAt: now,
    };

    getDb()
        .prepare(
            `INSERT INTO runtime_capabilities
             (id, display_name, state, healthy, reason, technical_message, metadata_json, checked_at, last_healthy_at, next_check_at, updated_at)
             VALUES ($id, $displayName, $state, $healthy, $reason, $technicalMessage, $metadataJson, $checkedAt, $lastHealthyAt, $nextCheckAt, $updatedAt)
             ON CONFLICT(id) DO UPDATE SET
               display_name = excluded.display_name,
               state = excluded.state,
               healthy = excluded.healthy,
               reason = excluded.reason,
               technical_message = excluded.technical_message,
               metadata_json = excluded.metadata_json,
               checked_at = excluded.checked_at,
               last_healthy_at = excluded.last_healthy_at,
               next_check_at = excluded.next_check_at,
               updated_at = excluded.updated_at`
        )
        .run(namedParams(row));

    return getRuntimeCapability(id);
}

function toCapability(row: RuntimeCapabilityRow): AgentRuntimeCapabilityHealth {
    return {
        checkedAt: row.checked_at,
        displayName: row.display_name,
        healthy: Boolean(row.healthy),
        id: row.id,
        lastHealthyAt: row.last_healthy_at,
        metadata: parseMetadata(row.metadata_json),
        nextCheckAt: row.next_check_at,
        reason: row.reason,
        state: row.state,
        technicalMessage: row.technical_message,
        updatedAt: row.updated_at,
    };
}

function parseMetadata(value: string): Record<string, unknown> {
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
}
