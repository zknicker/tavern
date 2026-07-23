import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as z from 'zod';
import { getAttachmentsDir } from '../config.ts';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { AgentApiError } from './agent-api-errors.ts';

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

export async function viewAgentAttachment(id: string, db: Database = getDb()) {
    const row = readAttachment(id, db);
    if (!row) {
        throw new AgentApiError('TARGET_NOT_FOUND', `Attachment ${id} was not found.`, 404);
    }
    const data = await fs.readFile(row.path).catch(() => null);
    if (!data) {
        throw new AgentApiError('TARGET_NOT_FOUND', `Attachment ${id} was not found.`, 404);
    }
    return {
        attachment: { ...attachmentSummary(row), dataBase64: data.toString('base64') },
    };
}

export function readAttachment(id: string, db: Database = getDb()): AttachmentRow | null {
    return db
        .prepare(
            `SELECT id, filename, media_type, byte_size, path
             FROM attachments WHERE id = $id LIMIT 1`
        )
        .get(namedParams({ id })) as AttachmentRow | null;
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
