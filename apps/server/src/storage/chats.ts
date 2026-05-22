import type { AgentRuntimeChat } from '@tavern/api';
import { and, asc, eq, ne, notInArray } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { chatsTable } from '../db/schema.ts';
import { getActiveRuntimeId } from './agent-runtime-connections.ts';

export type ChatRecord = typeof chatsTable.$inferSelect;

export async function listChatRecords(options?: {
    includeArchived?: boolean;
    includeInactive?: boolean;
    runtimeId?: string;
}) {
    const runtimeId = options?.includeInactive
        ? null
        : (options?.runtimeId ?? (await getActiveRuntimeId()));
    const query = db.select().from(chatsTable);
    const predicates = [
        ...(runtimeId ? [eq(chatsTable.runtimeId, runtimeId)] : []),
        ...(options?.includeArchived ? [] : [eq(chatsTable.isArchived, false)]),
    ];
    const scopedQuery = predicates.length > 0 ? query.where(and(...predicates)) : query;

    return await scopedQuery.orderBy(asc(chatsTable.id));
}

export async function getChatRecord(chatId: string) {
    const [chat] = await db.select().from(chatsTable).where(eq(chatsTable.id, chatId)).limit(1);

    return chat ?? null;
}

export async function syncChatsForRuntime(input: {
    chats: AgentRuntimeChat[];
    runtimeId: string;
    syncedAt?: string;
}) {
    const timestamp = input.syncedAt ?? new Date().toISOString();
    const syncedIds = input.chats.map((chat) => chat.id);

    for (const chat of input.chats) {
        await upsertChatRow({
            chat,
            runtimeId: input.runtimeId,
            timestamp,
        });
    }

    const staleRows =
        syncedIds.length > 0
            ? await db
                  .delete(chatsTable)
                  .where(
                      and(
                          eq(chatsTable.runtimeId, input.runtimeId),
                          ne(chatsTable.platform, 'tavern'),
                          notInArray(chatsTable.id, syncedIds)
                      )
                  )
                  .returning({ id: chatsTable.id })
            : await db
                  .delete(chatsTable)
                  .where(
                      and(
                          eq(chatsTable.runtimeId, input.runtimeId),
                          ne(chatsTable.platform, 'tavern')
                      )
                  )
                  .returning({ id: chatsTable.id });

    return {
        deleted: staleRows.length,
        synced: syncedIds.length,
    };
}

export async function archiveChatRecord(chatId: string) {
    const rows = await db
        .update(chatsTable)
        .set({
            isArchived: true,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(chatsTable.id, chatId))
        .returning({ id: chatsTable.id });

    return {
        archived: rows.length,
    };
}

export async function upsertChatForRuntime(input: {
    chat: AgentRuntimeChat;
    runtimeId: string;
    syncedAt?: string;
}) {
    await upsertChatRow({
        chat: input.chat,
        runtimeId: input.runtimeId,
        timestamp: input.syncedAt ?? new Date().toISOString(),
    });

    return {
        deleted: 0,
        synced: 1,
    };
}

export function parseChatRawJson(chat: ChatRecord) {
    return JSON.parse(chat.rawJson) as AgentRuntimeChat;
}

async function upsertChatRow(input: {
    chat: AgentRuntimeChat;
    runtimeId: string;
    timestamp: string;
}) {
    await db
        .insert(chatsTable)
        .values({
            bindingId: input.chat.bindingId,
            bindingsJson: JSON.stringify(input.chat.bindings),
            conversationKind: null,
            id: input.chat.id,
            inboundMode: input.chat.inboundMode,
            isArchived: false,
            lastSyncedAt: input.timestamp,
            metadataJson: JSON.stringify(input.chat.metadata),
            parentTarget: input.chat.parentTarget,
            platform: input.chat.platform,
            platformMetadataJson: JSON.stringify(input.chat.platformMetadata),
            rawJson: JSON.stringify(input.chat),
            requiresTrigger: input.chat.requiresTrigger,
            runtimeId: input.runtimeId,
            scope: input.chat.scope,
            target: input.chat.target,
            trigger: input.chat.trigger,
            updatedAt: input.timestamp,
        })
        .onConflictDoUpdate({
            target: chatsTable.id,
            set: {
                bindingId: input.chat.bindingId,
                bindingsJson: JSON.stringify(input.chat.bindings),
                inboundMode: input.chat.inboundMode,
                lastSyncedAt: input.timestamp,
                metadataJson: JSON.stringify(input.chat.metadata),
                parentTarget: input.chat.parentTarget,
                platform: input.chat.platform,
                platformMetadataJson: JSON.stringify(input.chat.platformMetadata),
                rawJson: JSON.stringify(input.chat),
                requiresTrigger: input.chat.requiresTrigger,
                runtimeId: input.runtimeId,
                scope: input.chat.scope,
                target: input.chat.target,
                trigger: input.chat.trigger,
                updatedAt: input.timestamp,
            },
        });
}
