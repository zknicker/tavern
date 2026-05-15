import { and, eq } from 'drizzle-orm';
import type {
    AgentRuntimeCapability,
    AgentRuntimeCapabilityState,
} from '../agent-runtime-connection/contracts.ts';
import { agentRuntimeCapabilityStatusSchema } from '../agent-runtime-connection/contracts.ts';
import { db } from '../db/index.ts';
import { agentRuntimeCapabilityStatusTable } from '../db/schema.ts';

export interface SaveAgentRuntimeCapabilityStatusInput {
    capability: AgentRuntimeCapability;
    checkedAt?: string;
    errorCode?: null | string;
    lastHealthyAt?: null | string;
    metadataJson?: null | string;
    method?: null | string;
    reason?: null | string;
    runtimeId: string;
    state: AgentRuntimeCapabilityState;
    technicalMessage?: null | string;
}

export async function listAgentRuntimeCapabilityStatuses(runtimeId: string) {
    const records = await db
        .select()
        .from(agentRuntimeCapabilityStatusTable)
        .where(eq(agentRuntimeCapabilityStatusTable.runtimeId, runtimeId));

    return records
        .map((record) => agentRuntimeCapabilityStatusSchema.parse(record))
        .sort((left, right) => left.capability.localeCompare(right.capability));
}

export async function getAgentRuntimeCapabilityStatus(input: {
    capability: AgentRuntimeCapability;
    runtimeId: string;
}) {
    const [record] = await db
        .select()
        .from(agentRuntimeCapabilityStatusTable)
        .where(
            and(
                eq(agentRuntimeCapabilityStatusTable.runtimeId, input.runtimeId),
                eq(agentRuntimeCapabilityStatusTable.capability, input.capability)
            )
        )
        .limit(1);

    return record ? agentRuntimeCapabilityStatusSchema.parse(record) : null;
}

export async function saveAgentRuntimeCapabilityStatus(
    input: SaveAgentRuntimeCapabilityStatusInput
) {
    const timestamp = input.checkedAt ?? new Date().toISOString();
    const existing = await getAgentRuntimeCapabilityStatus({
        capability: input.capability,
        runtimeId: input.runtimeId,
    });
    const lastHealthyAt =
        input.state === 'healthy'
            ? timestamp
            : (input.lastHealthyAt ?? existing?.lastHealthyAt ?? null);
    const row = {
        capability: input.capability,
        checkedAt: timestamp,
        errorCode: input.state === 'healthy' ? null : (input.errorCode ?? null),
        lastHealthyAt,
        metadataJson: input.state === 'healthy' ? null : (input.metadataJson ?? null),
        method: input.method ?? null,
        reason: input.state === 'healthy' ? null : (input.reason ?? null),
        runtimeId: input.runtimeId,
        state: input.state,
        technicalMessage: input.state === 'healthy' ? null : (input.technicalMessage ?? null),
        updatedAt: timestamp,
    };

    await db
        .insert(agentRuntimeCapabilityStatusTable)
        .values(row)
        .onConflictDoUpdate({
            target: [
                agentRuntimeCapabilityStatusTable.runtimeId,
                agentRuntimeCapabilityStatusTable.capability,
            ],
            set: row,
        });

    return agentRuntimeCapabilityStatusSchema.parse(row);
}

export async function markAgentRuntimeCapabilityHealthy(input: {
    capability: AgentRuntimeCapability;
    method?: null | string;
    runtimeId: string;
}) {
    return await saveAgentRuntimeCapabilityStatus({
        capability: input.capability,
        method: input.method ?? null,
        runtimeId: input.runtimeId,
        state: 'healthy',
    });
}
