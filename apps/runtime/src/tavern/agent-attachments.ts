import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as z from 'zod';
import { getAttachmentsDir } from '../config.ts';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { AgentApiError } from './agent-api-errors.ts';
import { createAgentParticipantId } from './chat-api/ids.ts';

const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

interface AttachmentRow {
    byte_size: number;
    filename: string;
    id: string;
    media_type: string | null;
    path: string;
}

export const agentAttachmentUploadRequestSchema = z
    .object({
        dataBase64: z.string(),
        filename: z.string().trim().min(1),
        mediaType: z.string().trim().min(1).optional(),
    })
    .strict();

export async function uploadAgentAttachment(
    agentId: string,
    input: z.infer<typeof agentAttachmentUploadRequestSchema>,
    options: { attachmentsDir?: string; db?: Database } = {}
) {
    if (
        path.basename(input.filename) !== input.filename ||
        input.filename === '.' ||
        input.filename === '..' ||
        input.filename.includes('\0')
    ) {
        throw new AgentApiError('INVALID_ARG', 'Attachment filename must not contain a path.', 400);
    }
    const bytes = decodeBase64(input.dataBase64);
    if (bytes.byteLength > MAX_ATTACHMENT_BYTES) {
        throw new AgentApiError('INVALID_ARG', 'Attachment exceeds the 50MB limit.', 400);
    }
    const db = options.db ?? getDb();
    const id = `att_${randomUUID().replaceAll('-', '').slice(0, 24)}`;
    const filePath = path.join(options.attachmentsDir ?? getAttachmentsDir(), id, input.filename);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, bytes);
    try {
        db.prepare(
            `INSERT INTO attachments
             (id, filename, media_type, byte_size, path, uploaded_by, created_at)
             VALUES ($id, $filename, $mediaType, $byteSize, $path, $uploadedBy, $createdAt)`
        ).run(
            namedParams({
                byteSize: bytes.byteLength,
                createdAt: new Date().toISOString(),
                filename: input.filename,
                id,
                mediaType: input.mediaType ?? null,
                path: filePath,
                uploadedBy: agentId,
            })
        );
    } catch (error) {
        await fs.rm(path.dirname(filePath), { force: true, recursive: true });
        throw error;
    }
    return {
        attachment: attachmentSummary({
            byte_size: bytes.byteLength,
            filename: input.filename,
            id,
            media_type: input.mediaType ?? null,
            path: filePath,
        }),
    };
}

export async function viewAgentAttachment(agentId: string, id: string, db: Database = getDb()) {
    const row = readAttachment(agentId, id, db);
    if (!row) {
        throw new AgentApiError(
            'ATTACHMENT_NOT_VISIBLE',
            `Attachment ${id} is not visible to the caller.`,
            403
        );
    }
    const data = await fs.readFile(row.path).catch(() => null);
    if (!data) {
        throw new AgentApiError('TARGET_NOT_FOUND', `Attachment ${id} was not found.`, 404);
    }
    return {
        attachment: { ...attachmentSummary(row), dataBase64: data.toString('base64') },
    };
}

export function readAttachment(
    agentId: string,
    id: string,
    db: Database = getDb()
): AttachmentRow | null {
    return db
        .prepare(
            `SELECT attachments.id, attachments.filename, attachments.media_type,
                    attachments.byte_size, attachments.path
             FROM attachments
             WHERE attachments.id = $id
               AND (
                 attachments.uploaded_by = $agentId
                 OR EXISTS (
                   SELECT 1
                   FROM chat_messages
                   JOIN chats ON chats.id = chat_messages.chat_id
                   JOIN chat_participants
                     ON chat_participants.chat_id = COALESCE(chats.parent_chat_id, chats.id)
                    AND chat_participants.id = $participantId
                    AND chat_participants.kind = 'agent'
                   JOIN json_each(COALESCE(chat_messages.attachment_json, '[]'))
                     ON json_extract(json_each.value, '$.id') = attachments.id
                   WHERE chat_messages.deleted_at IS NULL
                 )
               )
             LIMIT 1`
        )
        .get(
            namedParams({
                agentId,
                id,
                participantId: createAgentParticipantId(agentId),
            })
        ) as AttachmentRow | null;
}

function attachmentSummary(row: AttachmentRow) {
    return {
        byteSize: row.byte_size,
        filename: row.filename,
        id: row.id,
        mediaType: row.media_type,
    };
}

function decodeBase64(value: string): Buffer {
    if (
        value.length % 4 !== 0 ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)
    ) {
        throw new AgentApiError('INVALID_ARG', 'Attachment data is not valid base64.', 400);
    }
    return Buffer.from(value, 'base64');
}
