import type { AgentRuntimeAgent } from '@tavern/api';
import { and, asc, eq, notInArray } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { agentsTable } from '../db/schema.ts';
import { getActiveRuntimeId } from './agent-runtime-connections.ts';

export type AgentRecord = typeof agentsTable.$inferSelect;

export async function listAgents(options?: { includeInactive?: boolean; runtimeId?: string }) {
    const runtimeId = options?.includeInactive
        ? null
        : (options?.runtimeId ?? (await getActiveRuntimeId()));
    const query = db.select().from(agentsTable);
    const scopedQuery = runtimeId ? query.where(eq(agentsTable.runtimeId, runtimeId)) : query;

    return await scopedQuery.orderBy(asc(agentsTable.name));
}

export async function getAgent(agentId: string) {
    const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agentId)).limit(1);

    return agent ?? null;
}

export async function deleteAgent(agentId: string) {
    await db.delete(agentsTable).where(eq(agentsTable.id, agentId));
}

export async function updateAgentEnabledSkillIds(input: {
    agentId: string;
    enabledSkillIds: string[];
}) {
    await db
        .update(agentsTable)
        .set({
            enabledSkillIdsJson: JSON.stringify(input.enabledSkillIds),
            updatedAt: new Date().toISOString(),
        })
        .where(eq(agentsTable.id, input.agentId));
}

export async function syncAgentsForRuntime(input: {
    agents: AgentRuntimeAgent[];
    runtimeId: string;
    syncedAt?: string;
}) {
    const timestamp = input.syncedAt ?? new Date().toISOString();
    const syncedIds = input.agents.map((agent) => agent.id);

    for (const agent of input.agents) {
        await db
            .insert(agentsTable)
            .values({
                avatar: agent.avatar ?? null,
                createdAt: timestamp,
                emoji: agent.emoji ?? null,
                enabledSkillIdsJson: JSON.stringify(agent.enabledSkillIds ?? []),
                id: agent.id,
                lastSyncedAt: timestamp,
                name: agent.name,
                primaryColor: agent.primaryColor ?? null,
                rawJson: JSON.stringify(agent),
                runtimeId: input.runtimeId,
                updatedAt: timestamp,
                workspaceFolder: agent.workspaceFolder ?? null,
            })
            .onConflictDoUpdate({
                target: agentsTable.id,
                set: {
                    avatar: agent.avatar ?? null,
                    emoji: agent.emoji ?? null,
                    enabledSkillIdsJson: JSON.stringify(agent.enabledSkillIds ?? []),
                    lastSyncedAt: timestamp,
                    name: agent.name,
                    primaryColor: agent.primaryColor ?? null,
                    rawJson: JSON.stringify(agent),
                    runtimeId: input.runtimeId,
                    updatedAt: timestamp,
                    workspaceFolder: agent.workspaceFolder ?? null,
                },
            });
    }

    const staleRows =
        syncedIds.length > 0
            ? await db
                  .delete(agentsTable)
                  .where(
                      and(
                          eq(agentsTable.runtimeId, input.runtimeId),
                          notInArray(agentsTable.id, syncedIds)
                      )
                  )
                  .returning({ id: agentsTable.id })
            : await db
                  .delete(agentsTable)
                  .where(eq(agentsTable.runtimeId, input.runtimeId))
                  .returning({ id: agentsTable.id });

    return {
        deleted: staleRows.length,
        synced: syncedIds.length,
    };
}

export function parseAgentRawJson(agent: AgentRecord) {
    return JSON.parse(agent.rawJson) as AgentRuntimeAgent;
}
