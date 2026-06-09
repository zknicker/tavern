import type { TavernChatEvent } from '@tavern/api';
import { getDb } from '../../db/connection';
import type { Database } from '../../db/sqlite';
import { namedParams, optionalRow } from '../../db/sqlite';
import { log } from '../../log';
import { createEventId } from './ids';
import { clampLimit } from './limits';
import type { EventRow } from './types';

type Subscriber = (event: TavernChatEvent) => void;

const subscribers = new Map<Subscriber, { recipientId?: string | null }>();

export function subscribeToTavernApiEvents(
    subscriber: Subscriber,
    options: { recipientId?: string | null } = {}
) {
    subscribers.set(subscriber, options);
    return () => {
        subscribers.delete(subscriber);
    };
}

export function listEvents(
    input: { afterCursor?: string | null; limit?: number; recipientId?: string | null } = {},
    db: Database = getDb()
) {
    const limit = clampLimit(input.limit);
    const rows = db
        .prepare(
            `SELECT event_json
             FROM chat_events
             WHERE cursor > $afterCursor
             ORDER BY cursor ASC`
        )
        .all(
            namedParams({
                afterCursor: Number(input.afterCursor ?? 0),
            })
        ) as EventRow[];
    const visibleEvents = rows
        .map((row) => JSON.parse(row.event_json) as TavernChatEvent)
        .filter((event) => canReadEvent(event, input.recipientId));
    const events = visibleEvents.slice(0, limit);
    return {
        events,
        next_cursor: visibleEvents.length > limit ? (events.at(-1)?.cursor ?? null) : null,
    };
}

export function insertEvent(
    input: {
        chatId: string;
        event: TavernChatEvent['type'];
        payload: Record<string, unknown>;
        private?: boolean;
        recipients?: string[];
    },
    db: Database
): TavernChatEvent {
    const cursor = nextEventCursor(db);
    const createdAt = new Date().toISOString();
    const event = {
        chat_id: input.chatId,
        created_at: createdAt,
        cursor: String(cursor),
        id: createEventId(cursor),
        private: input.private ?? false,
        recipients: input.recipients ?? [],
        type: input.event,
        ...input.payload,
    } as TavernChatEvent;
    db.prepare(
        `INSERT INTO chat_events
         (cursor, id, event_type, chat_id, event_json, created_at, is_private, recipients_json)
         VALUES ($cursor, $id, $eventType, $chatId, $eventJson, $createdAt, $isPrivate, $recipientsJson)`
    ).run(
        namedParams({
            chatId: input.chatId,
            createdAt,
            cursor,
            eventJson: JSON.stringify(event),
            eventType: input.event,
            id: event.id,
            isPrivate: event.private ? 1 : 0,
            recipientsJson: JSON.stringify(event.recipients),
        })
    );
    return event;
}

export function replaceEventPayload(
    cursor: string,
    payload: Record<string, unknown>,
    db: Database
) {
    const row = optionalRow(
        db
            .prepare('SELECT event_json FROM chat_events WHERE cursor = $cursor')
            .get(namedParams({ cursor: Number(cursor) })) as EventRow | null
    );
    if (!row) {
        return;
    }
    const event = { ...(JSON.parse(row.event_json) as TavernChatEvent), ...payload };
    db.prepare('UPDATE chat_events SET event_json = $eventJson WHERE cursor = $cursor').run(
        namedParams({ cursor: Number(cursor), eventJson: JSON.stringify(event) })
    );
}

export function currentCursor(db: Database) {
    const row = db.prepare('SELECT COALESCE(MAX(cursor), 0) AS cursor FROM chat_events').get() as {
        cursor: number;
    };
    return String(row.cursor);
}

export function publish(event: TavernChatEvent) {
    for (const [subscriber, options] of subscribers) {
        if (canReadEvent(event, options.recipientId)) {
            try {
                subscriber(event);
            } catch (error) {
                log.warn('Tavern API event subscriber failed', { cursor: event.cursor, error });
            }
        }
    }
}

function canReadEvent(event: TavernChatEvent, recipientId: string | null | undefined) {
    if (!event.private) {
        return true;
    }

    return Boolean(recipientId && event.recipients.includes(recipientId));
}

function nextEventCursor(db: Database) {
    const row = db
        .prepare('SELECT COALESCE(MAX(cursor), 0) + 1 AS cursor FROM chat_events')
        .get() as {
        cursor: number;
    };
    return row.cursor;
}
