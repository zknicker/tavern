import type { TavernChatMessage } from '@tavern/api';
import { getDb } from '../../db/connection.ts';
import type { Database } from '../../db/sqlite.ts';
import { namedParams } from '../../db/sqlite.ts';
import { getMessage } from './messages.ts';

export class AmbiguousMessageIdError extends Error {
    readonly code = 'AMBIGUOUS_ID';

    constructor() {
        super('Short message id is ambiguous. Use the full message id.');
        this.name = 'AmbiguousMessageIdError';
    }
}

export function resolveMessageId(
    idOrShortId: string,
    input: { chatId?: string } = {},
    db: Database = getDb()
): TavernChatMessage | null {
    const exact = getMessage(idOrShortId, db);
    if (exact && (!input.chatId || exact.chat_id === input.chatId)) {
        return exact;
    }
    if (!/^[A-Fa-f0-9]{8}$/u.test(idOrShortId)) {
        return null;
    }
    const rows = db
        .prepare(
            `SELECT id FROM chat_messages
             WHERE deleted_at IS NULL
               AND lower(substr(id, 5, 8)) = lower($shortId)
               AND ($chatId IS NULL OR chat_id = $chatId)`
        )
        .all(namedParams({ chatId: input.chatId ?? null, shortId: idOrShortId })) as Array<{
        id: string;
    }>;
    const ids = rows.map((row) => row.id).filter((id) => /^msg_[A-Fa-f0-9]{32}$/u.test(id));
    if (ids.length > 1) {
        throw new AmbiguousMessageIdError();
    }
    const id = ids[0];
    return id ? getMessage(id, db) : null;
}
