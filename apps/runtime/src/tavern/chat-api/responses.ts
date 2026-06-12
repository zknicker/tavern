import type {
    TavernArtifact,
    TavernChatResponse,
    TavernListResponsesResponse,
    TavernResponseActivity,
    TavernUpsertArtifactRequest,
    TavernUpsertResponseActivityRequest,
    TavernUpsertResponseRequest,
} from '@tavern/api';
import { getDb } from '../../db/connection';
import type { Database } from '../../db/sqlite';
import { namedParams, optionalRow } from '../../db/sqlite';
import { assertChatExists } from './chats';
import { insertEvent, publish } from './events';
import { assertOptionalTavernIdPrefix, assertTavernIdPrefix } from './ids';
import { clampLimit } from './limits';
import type { ActivityRow, ArtifactRow, ResponseRow } from './types';

export function listResponses(
    chatId: string,
    input: { afterSequence?: number; limit?: number } = {},
    db: Database = getDb()
): TavernListResponsesResponse {
    const limit = clampLimit(input.limit);
    const rows = db
        .prepare(
            `SELECT *
             FROM (
               SELECT *, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS row_sequence
               FROM chat_responses
               WHERE chat_id = $chatId
             )
             WHERE row_sequence > $afterSequence
             ORDER BY row_sequence ASC
             LIMIT $limit`
        )
        .all(
            namedParams({ afterSequence: input.afterSequence ?? 0, chatId, limit })
        ) as (ResponseRow & {
        row_sequence: number;
    })[];
    const responseIds = rows.map((row) => row.id);
    const responses = rows.map(rowToResponse);

    return {
        activity: listActivityForResponses(responseIds, db),
        artifacts: listArtifactsForResponses(responseIds, db),
        next_sequence:
            responses.length === limit
                ? (rows.at(-1)?.row_sequence ?? input.afterSequence ?? 0)
                : null,
        responses,
    };
}

export function upsertResponse(
    chatId: string,
    input: TavernUpsertResponseRequest,
    db: Database = getDb()
): { created: boolean; response: TavernChatResponse } {
    assertResponseInputIds(chatId, input);
    const existing = getResponse(input.id, db);
    const now = new Date().toISOString();

    db.exec('BEGIN IMMEDIATE');
    try {
        assertChatExists(chatId, db);
        db.prepare(
            `INSERT INTO chat_responses
             (id, chat_id, participant_id, request_message_id, response_message_id, status,
              summary, metadata_json, created_at, updated_at, completed_at)
             VALUES ($id, $chatId, $participantId, $requestMessageId, $responseMessageId,
              $status, $summary, $metadataJson, $createdAt, $updatedAt, $completedAt)
             ON CONFLICT(id) DO UPDATE SET
               participant_id = excluded.participant_id,
               request_message_id = excluded.request_message_id,
               response_message_id = COALESCE(excluded.response_message_id, chat_responses.response_message_id),
               status = excluded.status,
               summary = excluded.summary,
               metadata_json = excluded.metadata_json,
               updated_at = excluded.updated_at,
               completed_at = excluded.completed_at`
        ).run(
            namedParams({
                chatId,
                completedAt: input.completed_at ?? terminalTime(input.status, now),
                createdAt: existing?.created_at ?? now,
                id: input.id,
                metadataJson: JSON.stringify(input.metadata ?? {}),
                participantId: input.participant_id,
                requestMessageId: input.request_message_id ?? null,
                responseMessageId: input.response_message_id ?? null,
                status: input.status,
                summary: input.summary ?? null,
                updatedAt: now,
            })
        );
        const response = getResponseOrThrow(input.id, db);
        closeOpenActivityForTerminalResponse(response.id, response.status, now, db);
        const event = insertEvent(
            {
                chatId,
                event: responseEventType(response.status, !existing),
                payload: { response },
            },
            db
        );
        db.exec('COMMIT');
        publish(event);
        return { created: !existing, response };
    } catch (error) {
        rollbackTransaction(db);
        throw error;
    }
}

export function upsertResponseActivity(
    chatId: string,
    responseId: string,
    input: TavernUpsertResponseActivityRequest,
    db: Database = getDb()
): { activity: TavernResponseActivity; created: boolean } {
    assertActivityInputIds(chatId, responseId, input);
    const existing = getResponseActivity(input.id, db);
    const now = new Date().toISOString();

    db.exec('BEGIN IMMEDIATE');
    try {
        const response = getResponseOrThrow(responseId, db);
        if (response.chat_id !== chatId) {
            throw new Error(`Response ${responseId} does not belong to chat ${chatId}.`);
        }
        if (existing && (existing.chat_id !== chatId || existing.response_id !== responseId)) {
            throw new Error(
                `Activity ${input.id} belongs to response ${existing.response_id} in chat ${existing.chat_id}.`
            );
        }
        const sequence = input.sequence ?? nextActivitySequence(responseId, db);
        db.prepare(
            `INSERT INTO chat_response_activity
             (id, response_id, chat_id, sequence, kind, status, title, detail, summary,
              artifact_ids_json, metadata_json, started_at, updated_at, completed_at)
             VALUES ($id, $responseId, $chatId, $sequence, $kind, $status, $title, $detail,
              $summary, $artifactIdsJson, $metadataJson, $startedAt, $updatedAt, $completedAt)
             ON CONFLICT(id) DO UPDATE SET
               kind = excluded.kind,
               status = excluded.status,
               title = excluded.title,
               detail = excluded.detail,
               summary = excluded.summary,
               artifact_ids_json = excluded.artifact_ids_json,
               metadata_json = excluded.metadata_json,
               updated_at = excluded.updated_at,
               completed_at = excluded.completed_at`
        ).run(
            namedParams({
                artifactIdsJson: JSON.stringify(input.artifact_ids ?? []),
                chatId,
                completedAt: input.completed_at ?? terminalTime(input.status, now),
                detail: input.detail ?? null,
                id: input.id,
                kind: input.kind,
                metadataJson: JSON.stringify(input.metadata ?? {}),
                responseId,
                sequence: existing?.sequence ?? sequence,
                startedAt: input.started_at ?? existing?.started_at ?? now,
                status: input.status,
                summary: input.summary ?? null,
                title: input.title,
                updatedAt: now,
            })
        );
        touchResponse(responseId, now, db);
        const activity = getResponseActivityOrThrow(input.id, db);
        const event = insertEvent(
            {
                chatId,
                event: activityEventType(activity.status, !existing),
                payload: { activity },
            },
            db
        );
        db.exec('COMMIT');
        publish(event);
        return { activity, created: !existing };
    } catch (error) {
        rollbackTransaction(db);
        throw error;
    }
}

export function upsertArtifact(
    chatId: string,
    input: TavernUpsertArtifactRequest,
    db: Database = getDb()
): { artifact: TavernArtifact; created: boolean } {
    assertArtifactInputIds(chatId, input);
    const existing = getArtifact(input.id, db);
    const now = new Date().toISOString();

    db.exec('BEGIN IMMEDIATE');
    try {
        assertChatExists(chatId, db);
        db.prepare(
            `INSERT INTO chat_artifacts
             (id, chat_id, response_id, activity_id, message_id, kind, title, content_text,
              content_ref, mime_type, metadata_json, created_at, updated_at)
             VALUES ($id, $chatId, $responseId, $activityId, $messageId, $kind, $title,
              $contentText, $contentRef, $mimeType, $metadataJson, $createdAt, $updatedAt)
             ON CONFLICT(id) DO UPDATE SET
               response_id = excluded.response_id,
               activity_id = excluded.activity_id,
               message_id = excluded.message_id,
               kind = excluded.kind,
               title = excluded.title,
               content_text = excluded.content_text,
               content_ref = excluded.content_ref,
               mime_type = excluded.mime_type,
               metadata_json = excluded.metadata_json,
               updated_at = excluded.updated_at`
        ).run(
            namedParams({
                activityId: input.activity_id ?? null,
                chatId,
                contentRef: input.content_ref ?? null,
                contentText: input.content_text ?? null,
                createdAt: existing?.created_at ?? now,
                id: input.id,
                kind: input.kind,
                messageId: input.message_id ?? null,
                metadataJson: JSON.stringify(input.metadata ?? {}),
                mimeType: input.mime_type ?? null,
                responseId: input.response_id ?? null,
                title: input.title ?? null,
                updatedAt: now,
            })
        );
        const artifact = getArtifactOrThrow(input.id, db);
        const event = insertEvent({ chatId, event: 'artifact.created', payload: { artifact } }, db);
        db.exec('COMMIT');
        publish(event);
        return { artifact, created: !existing };
    } catch (error) {
        rollbackTransaction(db);
        throw error;
    }
}

export function getResponse(id: string, db: Database = getDb()): TavernChatResponse | null {
    const row = optionalRow(
        db
            .prepare('SELECT * FROM chat_responses WHERE id = $id')
            .get(namedParams({ id })) as ResponseRow | null
    );
    return row ? rowToResponse(row) : null;
}

function getResponseOrThrow(id: string, db: Database): TavernChatResponse {
    const response = getResponse(id, db);
    if (!response) {
        throw new Error(`Missing chat response ${id}.`);
    }
    return response;
}

export function getResponseActivity(
    id: string,
    db: Database = getDb()
): TavernResponseActivity | null {
    const row = optionalRow(
        db
            .prepare('SELECT * FROM chat_response_activity WHERE id = $id')
            .get(namedParams({ id })) as ActivityRow | null
    );
    return row ? rowToActivity(row) : null;
}

export function listActivityForResponses(
    responseIds: readonly string[],
    db: Database
): TavernResponseActivity[] {
    if (responseIds.length === 0) {
        return [];
    }

    const placeholders = responseIds.map((_, index) => `$responseId${index}`).join(', ');
    const params = Object.fromEntries(responseIds.map((id, index) => [`responseId${index}`, id]));
    const rows = db
        .prepare(
            `SELECT *
             FROM chat_response_activity
             WHERE response_id IN (${placeholders})
             ORDER BY response_id ASC, sequence ASC, updated_at ASC, id ASC`
        )
        .all(namedParams(params)) as ActivityRow[];

    return rows.map(rowToActivity);
}

export function listArtifactsForResponses(
    responseIds: readonly string[],
    db: Database
): TavernArtifact[] {
    if (responseIds.length === 0) {
        return [];
    }

    const placeholders = responseIds.map((_, index) => `$responseId${index}`).join(', ');
    const params = Object.fromEntries(responseIds.map((id, index) => [`responseId${index}`, id]));
    const rows = db
        .prepare(
            `SELECT *
             FROM chat_artifacts
             WHERE response_id IN (${placeholders})
             ORDER BY created_at ASC, id ASC`
        )
        .all(namedParams(params)) as ArtifactRow[];

    return rows.map(rowToArtifact);
}

function getResponseActivityOrThrow(id: string, db: Database): TavernResponseActivity {
    const activity = getResponseActivity(id, db);
    if (!activity) {
        throw new Error(`Missing response activity ${id}.`);
    }
    return activity;
}

function getArtifact(id: string, db: Database = getDb()): TavernArtifact | null {
    const row = optionalRow(
        db
            .prepare('SELECT * FROM chat_artifacts WHERE id = $id')
            .get(namedParams({ id })) as ArtifactRow | null
    );
    return row ? rowToArtifact(row) : null;
}

function getArtifactOrThrow(id: string, db: Database): TavernArtifact {
    const artifact = getArtifact(id, db);
    if (!artifact) {
        throw new Error(`Missing chat artifact ${id}.`);
    }
    return artifact;
}

function nextActivitySequence(responseId: string, db: Database) {
    const row = db
        .prepare(
            `SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence
             FROM chat_response_activity
             WHERE response_id = $responseId`
        )
        .get(namedParams({ responseId })) as { sequence: number };
    return row.sequence;
}

function touchResponse(responseId: string, updatedAt: string, db: Database) {
    db.prepare(
        `UPDATE chat_responses
         SET updated_at = $updatedAt,
             status = CASE
               WHEN status IN ('queued') THEN 'running'
               ELSE status
             END
         WHERE id = $responseId`
    ).run(namedParams({ responseId, updatedAt }));
}

function closeOpenActivityForTerminalResponse(
    responseId: string,
    status: TavernChatResponse['status'],
    now: string,
    db: Database
) {
    if (status !== 'completed' && status !== 'failed' && status !== 'cancelled') {
        return;
    }

    db.prepare(
        `UPDATE chat_response_activity
         SET status = CASE
               WHEN status IN ('queued', 'running') THEN $status
               ELSE status
             END,
             updated_at = $updatedAt,
             completed_at = COALESCE(completed_at, $completedAt)
         WHERE response_id = $responseId
           AND status IN ('queued', 'running')`
    ).run(
        namedParams({
            completedAt: now,
            responseId,
            status,
            updatedAt: now,
        })
    );
}

function assertResponseInputIds(chatId: string, input: TavernUpsertResponseRequest) {
    assertTavernIdPrefix(chatId, 'cht_', 'Chat id');
    assertTavernIdPrefix(input.id, 'rsp_', 'Response id');
    assertTavernIdPrefix(input.participant_id, 'agt_', 'Response participant id');
    assertOptionalTavernIdPrefix(input.request_message_id, 'msg_', 'Request message id');
    assertOptionalTavernIdPrefix(input.response_message_id, 'msg_', 'Response message id');
}

function assertActivityInputIds(
    chatId: string,
    responseId: string,
    input: TavernUpsertResponseActivityRequest
) {
    assertTavernIdPrefix(chatId, 'cht_', 'Chat id');
    assertTavernIdPrefix(responseId, 'rsp_', 'Response id');
    assertTavernIdPrefix(input.id, 'act_', 'Activity id');
    for (const artifactId of input.artifact_ids ?? []) {
        assertTavernIdPrefix(artifactId, 'art_', 'Artifact id');
    }
}

function assertArtifactInputIds(chatId: string, input: TavernUpsertArtifactRequest) {
    assertTavernIdPrefix(chatId, 'cht_', 'Chat id');
    assertTavernIdPrefix(input.id, 'art_', 'Artifact id');
    assertOptionalTavernIdPrefix(input.response_id, 'rsp_', 'Artifact response id');
    assertOptionalTavernIdPrefix(input.activity_id, 'act_', 'Artifact activity id');
    assertOptionalTavernIdPrefix(input.message_id, 'msg_', 'Artifact message id');
}

function terminalTime(status: TavernChatResponse['status'], now: string) {
    return status === 'completed' || status === 'failed' || status === 'cancelled' ? now : null;
}

function rollbackTransaction(db: Database) {
    try {
        db.exec('ROLLBACK');
    } catch {
        // Keep the original transaction failure visible.
    }
}

function responseEventType(status: TavernChatResponse['status'], created: boolean) {
    if (status === 'completed') {
        return 'response.completed';
    }
    if (status === 'failed') {
        return 'response.failed';
    }
    if (created) {
        return 'response.created';
    }
    return 'response.updated';
}

function activityEventType(status: TavernResponseActivity['status'], created: boolean) {
    if (created) {
        return 'activity.created';
    }
    if (status === 'completed') {
        return 'activity.completed';
    }
    if (status === 'failed') {
        return 'activity.failed';
    }
    return 'activity.updated';
}

export function rowToResponse(row: ResponseRow): TavernChatResponse {
    return {
        chat_id: row.chat_id,
        completed_at: row.completed_at,
        created_at: row.created_at,
        id: row.id,
        metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
        participant_id: row.participant_id,
        request_message_id: row.request_message_id,
        response_message_id: row.response_message_id,
        status: row.status,
        summary: row.summary,
        updated_at: row.updated_at,
    };
}

function rowToActivity(row: ActivityRow): TavernResponseActivity {
    return {
        artifact_ids: JSON.parse(row.artifact_ids_json) as string[],
        chat_id: row.chat_id,
        completed_at: row.completed_at,
        detail: row.detail,
        id: row.id,
        kind: row.kind,
        metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
        response_id: row.response_id,
        sequence: row.sequence,
        started_at: row.started_at,
        status: row.status,
        summary: row.summary,
        title: row.title,
        updated_at: row.updated_at,
    };
}

function rowToArtifact(row: ArtifactRow): TavernArtifact {
    return {
        activity_id: row.activity_id,
        chat_id: row.chat_id,
        content_ref: row.content_ref,
        content_text: row.content_text,
        created_at: row.created_at,
        id: row.id,
        kind: row.kind as TavernArtifact['kind'],
        message_id: row.message_id,
        metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
        mime_type: row.mime_type,
        response_id: row.response_id,
        title: row.title,
        updated_at: row.updated_at,
    };
}
