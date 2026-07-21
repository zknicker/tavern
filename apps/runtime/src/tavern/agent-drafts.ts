import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';

export const agentDraftTtlMs = 10 * 60 * 1000;

export interface AgentDraft {
    agentId: string;
    attachmentIds: string[];
    chatId: string;
    content: string;
    reholdCount: number;
    savedAt: string;
}

interface DraftRow {
    agent_id: string;
    attachment_ids_json: string;
    chat_id: string;
    content: string;
    rehold_count: number;
    saved_at: string;
}

export function readAgentDraft(
    agentId: string,
    chatId: string,
    input: { now?: Date } = {},
    db: Database = getDb()
): AgentDraft | null {
    const row = db
        .prepare(
            `SELECT * FROM agent_message_drafts
             WHERE agent_id = $agentId AND chat_id = $chatId`
        )
        .get(namedParams({ agentId, chatId })) as DraftRow | null;
    if (!row) {
        return null;
    }
    const now = input.now ?? new Date();
    if (now.getTime() - new Date(row.saved_at).getTime() >= agentDraftTtlMs) {
        clearAgentDraft(agentId, chatId, db);
        return null;
    }
    return rowToDraft(row);
}

export function saveAgentDraft(
    input: {
        agentId: string;
        attachmentIds: string[];
        chatId: string;
        content: string;
        now?: Date;
        reholdCount: number;
    },
    db: Database = getDb()
): AgentDraft {
    const savedAt = (input.now ?? new Date()).toISOString();
    db.prepare(
        `INSERT INTO agent_message_drafts
         (agent_id, chat_id, content, attachment_ids_json, rehold_count, saved_at)
         VALUES ($agentId, $chatId, $content, $attachmentIdsJson, $reholdCount, $savedAt)
         ON CONFLICT(agent_id, chat_id) DO UPDATE SET
           content = excluded.content,
           attachment_ids_json = excluded.attachment_ids_json,
           rehold_count = excluded.rehold_count,
           saved_at = excluded.saved_at`
    ).run(
        namedParams({
            agentId: input.agentId,
            attachmentIdsJson: JSON.stringify(input.attachmentIds),
            chatId: input.chatId,
            content: input.content,
            reholdCount: input.reholdCount,
            savedAt,
        })
    );
    return {
        agentId: input.agentId,
        attachmentIds: input.attachmentIds,
        chatId: input.chatId,
        content: input.content,
        reholdCount: input.reholdCount,
        savedAt,
    };
}

export function clearAgentDraft(agentId: string, chatId: string, db: Database = getDb()): void {
    db.prepare(
        'DELETE FROM agent_message_drafts WHERE agent_id = $agentId AND chat_id = $chatId'
    ).run(namedParams({ agentId, chatId }));
}

function rowToDraft(row: DraftRow): AgentDraft {
    const parsed = JSON.parse(row.attachment_ids_json) as unknown;
    if (!Array.isArray(parsed) || parsed.some((id) => typeof id !== 'string')) {
        throw new Error('Stored agent draft attachment ids are invalid.');
    }
    return {
        agentId: row.agent_id,
        attachmentIds: parsed,
        chatId: row.chat_id,
        content: row.content,
        reholdCount: row.rehold_count,
        savedAt: row.saved_at,
    };
}
