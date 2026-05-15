import type {
    AgentRuntimeBinding,
    AgentRuntimeUpsertBinding,
} from '@tavern/agent-runtime-protocol';
import { asc, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { messagingBindingsTable } from '../db/schema.ts';

function parseJsonRecord(value: string): Record<string, unknown> {
    try {
        const parsed = JSON.parse(value) as unknown;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : {};
    } catch {
        return {};
    }
}

function parseMatch(value: string): Record<string, string[]> {
    const parsed = parseJsonRecord(value);

    return Object.fromEntries(
        Object.entries(parsed).map(([key, entry]) => [
            key,
            Array.isArray(entry)
                ? entry.filter(
                      (item): item is string => typeof item === 'string' && item.trim().length > 0
                  )
                : [],
        ])
    );
}

function serializeMatch(match: Record<string, string[]>) {
    return JSON.stringify(match);
}

function serializeMetadata(metadata: Record<string, unknown>) {
    return JSON.stringify(metadata);
}

function mapStoredBinding(row: {
    agentId: string;
    enabled: string;
    id: string;
    inboundMode: string;
    matchJson: string;
    metadataJson: string;
    name: string;
    platform: string;
    token: string;
    updatedAt: string;
}): AgentRuntimeBinding {
    return {
        agentId: row.agentId,
        enabled: row.enabled === 'true',
        id: row.id,
        inboundMode: row.inboundMode as AgentRuntimeBinding['inboundMode'],
        match: parseMatch(row.matchJson),
        metadata: parseJsonRecord(row.metadataJson),
        name: row.name,
        platform: row.platform,
        status: row.enabled === 'true' ? 'configured' : 'disabled',
        statusMessage: null,
        token: row.token,
        updatedAt: row.updatedAt,
    };
}

export async function listStoredMessagingBindings(): Promise<AgentRuntimeBinding[]> {
    const rows = await db
        .select()
        .from(messagingBindingsTable)
        .orderBy(asc(messagingBindingsTable.platform), asc(messagingBindingsTable.name));

    return rows.map(mapStoredBinding);
}

export async function saveStoredMessagingBinding(
    input: AgentRuntimeUpsertBinding
): Promise<AgentRuntimeBinding> {
    const timestamp = new Date().toISOString();

    await db
        .insert(messagingBindingsTable)
        .values({
            agentId: input.agentId,
            createdAt: timestamp,
            enabled: String(input.enabled ?? true),
            id: input.id,
            inboundMode: input.inboundMode ?? 'active',
            matchJson: serializeMatch(input.match ?? {}),
            metadataJson: serializeMetadata(input.metadata ?? {}),
            name: input.name,
            platform: input.platform,
            token: input.token,
            updatedAt: timestamp,
        })
        .onConflictDoUpdate({
            target: messagingBindingsTable.id,
            set: {
                agentId: input.agentId,
                enabled: String(input.enabled ?? true),
                inboundMode: input.inboundMode ?? 'active',
                matchJson: serializeMatch(input.match ?? {}),
                metadataJson: serializeMetadata(input.metadata ?? {}),
                name: input.name,
                platform: input.platform,
                token: input.token,
                updatedAt: timestamp,
            },
        });

    const [row] = await db
        .select()
        .from(messagingBindingsTable)
        .where(eq(messagingBindingsTable.id, input.id))
        .limit(1);

    if (!row) {
        throw new Error(`Failed to save messaging binding "${input.id}".`);
    }

    return mapStoredBinding(row);
}

export async function deleteStoredMessagingBinding(bindingId: string) {
    const [existing] = await db
        .select()
        .from(messagingBindingsTable)
        .where(eq(messagingBindingsTable.id, bindingId))
        .limit(1);

    if (!existing) {
        return false;
    }

    await db.delete(messagingBindingsTable).where(eq(messagingBindingsTable.id, bindingId));
    return true;
}
