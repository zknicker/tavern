import {
    type AgentRuntimeChatPaneState,
    type AgentRuntimeSetChatPaneStateRequest,
    type ChatPaneTarget,
    chatPaneTargetKey,
    chatPaneTargetSchema,
} from '@tavern/api';
import * as z from 'zod';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';

// The artifact pane's tab set is Runtime state so it survives app reloads and
// stays writable by both user gestures (revision-guarded full replace) and
// agent UI intents (atomic open-target merge). See specs/agent-app-control.md.

interface ChatPaneStateRow {
    active_key: string | null;
    chat_id: string;
    revision: number;
    targets_json: string;
    updated_at: string;
}

export class ChatPaneRevisionConflictError extends Error {
    constructor(readonly current: AgentRuntimeChatPaneState) {
        super('Chat pane state changed; refetch and retry with the current revision.');
    }
}

export function getChatPaneState(
    chatId: string,
    db: Database = getDb()
): AgentRuntimeChatPaneState {
    const row = db
        .prepare('SELECT * FROM chat_pane_states WHERE chat_id = $chatId')
        .get(namedParams({ chatId })) as ChatPaneStateRow | null;
    if (!row) {
        return { activeKey: null, chatId, revision: 0, targets: [], updatedAt: null };
    }
    return rowToState(row);
}

export function setChatPaneState(
    chatId: string,
    input: AgentRuntimeSetChatPaneStateRequest,
    db: Database = getDb()
): AgentRuntimeChatPaneState {
    const current = getChatPaneState(chatId, db);
    if (current.revision !== input.expectedRevision) {
        throw new ChatPaneRevisionConflictError(current);
    }
    if (input.activeKey && !input.targets.some((t) => chatPaneTargetKey(t) === input.activeKey)) {
        throw new Error('activeKey must reference one of the submitted targets.');
    }
    return writeState(chatId, current.revision + 1, input.targets, input.activeKey, db);
}

// Atomic merge used by agent UI intents: append the target if absent, focus
// it, bump the revision. Never rejects on revision — the op is commutative
// with user gestures.
export function openChatPaneTarget(
    chatId: string,
    target: ChatPaneTarget,
    db: Database = getDb()
): AgentRuntimeChatPaneState {
    const current = getChatPaneState(chatId, db);
    const key = chatPaneTargetKey(target);
    const targets = current.targets.some((t) => chatPaneTargetKey(t) === key)
        ? current.targets
        : [...current.targets, target];
    return writeState(chatId, current.revision + 1, targets, key, db);
}

function writeState(
    chatId: string,
    revision: number,
    targets: ChatPaneTarget[],
    activeKey: string | null,
    db: Database
): AgentRuntimeChatPaneState {
    const now = new Date().toISOString();
    db.prepare(
        `INSERT INTO chat_pane_states (chat_id, revision, targets_json, active_key, updated_at)
         VALUES ($chatId, $revision, $targetsJson, $activeKey, $now)
         ON CONFLICT(chat_id) DO UPDATE SET
             revision = $revision,
             targets_json = $targetsJson,
             active_key = $activeKey,
             updated_at = $now`
    ).run(
        namedParams({
            activeKey,
            chatId,
            now,
            revision,
            targetsJson: JSON.stringify(targets),
        })
    );
    return { activeKey, chatId, revision, targets, updatedAt: now };
}

function rowToState(row: ChatPaneStateRow): AgentRuntimeChatPaneState {
    return {
        activeKey: row.active_key,
        chatId: row.chat_id,
        revision: row.revision,
        targets: z.array(chatPaneTargetSchema).parse(JSON.parse(row.targets_json)),
        updatedAt: row.updated_at,
    };
}
