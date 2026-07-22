import type { TavernChatResponse, TavernChatTimelinePage } from '@tavern/api';
import { getDb } from '../../db/connection';
import type { Database } from '../../db/sqlite';
import { namedParams } from '../../db/sqlite';
import { assertChatExists } from './chats';
import { assertTavernIdPrefix, localHumanParticipantId } from './ids';
import { clampLimit } from './limits';
import { rowToMessage } from './messages';
import { listActivityForResponses, listArtifactsForResponses, rowToResponse } from './responses';
import { threadSummaries } from './threads';
import type { MessageRow, ResponseRow } from './types';

// A turn that needs more passes than this is pathologically interleaved;
// the page ships as-is and the next older page completes it.
const maxAlignmentPasses = 5;

/**
 * One turn-aligned page of chat history, walked backward from the newest
 * message by per-chat message sequence.
 *
 * The page carries whole turn units: the message window plus every response
 * anchored to a window message by request or reply, with that response's
 * full activity and artifacts. The window extends downward so an in-window
 * reply always ships with its request message. A turn whose request and
 * reply straddle a page boundary is anchored to both pages; consumers
 * deduplicate by id. Responses with no message anchor ride the latest page.
 */
export function getChatTimelinePage(
    chatId: string,
    input: { beforeSequence?: number; limit?: number; readerId?: string } = {},
    db: Database = getDb()
): TavernChatTimelinePage {
    assertTavernIdPrefix(chatId, 'cht_', 'Chat id');
    assertChatExists(chatId, db);

    const limit = clampLimit(input.limit);
    const isLatestPage = input.beforeSequence === undefined;
    let messageRows = listMessageWindow(
        chatId,
        { beforeSequence: input.beforeSequence, limit },
        db
    );
    let responses = listAnchoredResponses(chatId, messageRows, db);

    for (let pass = 0; pass < maxAlignmentPasses; pass += 1) {
        const extended = extendWindowToRequestMessages(chatId, messageRows, responses, db);

        if (extended.length === messageRows.length) {
            break;
        }

        messageRows = extended;
        responses = listAnchoredResponses(chatId, messageRows, db);
    }

    if (isLatestPage) {
        responses = [...responses, ...listUnanchoredResponses(chatId, db)];
    }

    const responseIds = responses.map((response) => response.id);
    const oldestSequence = messageRows[0]?.sequence;
    const readerId = input.readerId ?? localHumanParticipantId;
    assertTavernIdPrefix(readerId, 'usr_', 'Chat reader id');

    return {
        activity: listActivityForResponses(responseIds, db),
        artifacts: listArtifactsForResponses(responseIds, db),
        messages: messageRows.map((row) => rowToMessage(row, db)),
        next_before_sequence:
            oldestSequence !== undefined && hasMessagesBefore(chatId, oldestSequence, db)
                ? oldestSequence
                : null,
        responses,
        // Only this page's anchors need summaries; the consumer attaches
        // them to in-window message rows and nothing else.
        threads: threadSummaries(
            chatId,
            readerId,
            db,
            messageRows.map((row) => row.id)
        ),
        total_messages: countMessages(chatId, db),
    };
}

function listMessageWindow(
    chatId: string,
    input: { beforeSequence?: number; limit: number },
    db: Database
): MessageRow[] {
    const rows = db
        .prepare(
            `SELECT *
             FROM chat_messages
             WHERE chat_id = $chatId
               AND ($beforeSequence IS NULL OR sequence < $beforeSequence)
             ORDER BY sequence DESC
             LIMIT $limit`
        )
        .all(
            namedParams({
                beforeSequence: input.beforeSequence ?? null,
                chatId,
                limit: input.limit,
            })
        ) as MessageRow[];

    return rows.reverse();
}

function listAnchoredResponses(
    chatId: string,
    messageRows: MessageRow[],
    db: Database
): TavernChatResponse[] {
    if (messageRows.length === 0) {
        return [];
    }

    const placeholders = messageRows.map((_, index) => `$messageId${index}`).join(', ');
    const params = Object.fromEntries(
        messageRows.map((row, index) => [`messageId${index}`, row.id])
    );
    const rows = db
        .prepare(
            `SELECT *
             FROM chat_responses
             WHERE chat_id = $chatId
               AND (request_message_id IN (${placeholders})
                 OR response_message_id IN (${placeholders}))
             ORDER BY created_at ASC, id ASC`
        )
        .all(namedParams({ ...params, chatId })) as ResponseRow[];

    return rows.map(rowToResponse);
}

// Live and automation turns may not be linked to messages yet; they belong
// to the newest history, so only the latest page carries them.
function listUnanchoredResponses(chatId: string, db: Database): TavernChatResponse[] {
    const rows = db
        .prepare(
            `SELECT *
             FROM chat_responses
             WHERE chat_id = $chatId
               AND request_message_id IS NULL
               AND response_message_id IS NULL
             ORDER BY created_at ASC, id ASC`
        )
        .all(namedParams({ chatId })) as ResponseRow[];

    return rows.map(rowToResponse);
}

// Pull the contiguous message range down to the lowest request message of
// any anchored response, so a reply never ships without its request. Newer
// pages are always loaded first, so upward extension is never needed.
function extendWindowToRequestMessages(
    chatId: string,
    messageRows: MessageRow[],
    responses: TavernChatResponse[],
    db: Database
): MessageRow[] {
    const windowStart = messageRows[0]?.sequence;

    if (windowStart === undefined) {
        return messageRows;
    }

    const missingRequestIds = responses
        .map((response) => response.request_message_id)
        .filter((id): id is string => id !== null && !messageRows.some((row) => row.id === id));

    if (missingRequestIds.length === 0) {
        return messageRows;
    }

    const placeholders = missingRequestIds.map((_, index) => `$requestId${index}`).join(', ');
    const params = Object.fromEntries(
        missingRequestIds.map((id, index) => [`requestId${index}`, id])
    );
    const lowest = db
        .prepare(
            `SELECT MIN(sequence) AS sequence
             FROM chat_messages
             WHERE chat_id = $chatId AND id IN (${placeholders})`
        )
        .get(namedParams({ ...params, chatId })) as { sequence: number | null };

    if (lowest.sequence === null || lowest.sequence >= windowStart) {
        return messageRows;
    }

    const extension = db
        .prepare(
            `SELECT *
             FROM chat_messages
             WHERE chat_id = $chatId
               AND sequence >= $fromSequence
               AND sequence < $toSequence
             ORDER BY sequence ASC`
        )
        .all(
            namedParams({
                chatId,
                fromSequence: lowest.sequence,
                toSequence: windowStart,
            })
        ) as MessageRow[];

    return [...extension, ...messageRows];
}

function hasMessagesBefore(chatId: string, sequence: number, db: Database) {
    const row = db
        .prepare(
            `SELECT 1 AS present
             FROM chat_messages
             WHERE chat_id = $chatId AND sequence < $sequence
             LIMIT 1`
        )
        .get(namedParams({ chatId, sequence })) as { present: number } | null;

    return row !== null;
}

function countMessages(chatId: string, db: Database) {
    const row = db
        .prepare('SELECT COUNT(*) AS count FROM chat_messages WHERE chat_id = $chatId')
        .get(namedParams({ chatId })) as { count: number };

    return row.count;
}
