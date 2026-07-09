import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
    type AgentRuntimeTaskAttachment,
    agentRuntimeTaskAttachmentContentSchema,
    agentRuntimeTaskAttachmentSchema,
} from '@tavern/api';
import { RUNTIME_ROOT, readConfigValue, resolveConfiguredPath } from '../config.ts';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { getStoredAgent } from '../tavern/agents-store.ts';
import { publishTaskUpdated } from './events.ts';

interface AttachmentRow {
    byte_size: number;
    filename: string;
    id: string;
    media_type: string | null;
    promoted_at: string;
    source_path: string;
    task_id: string;
}
const mediaTypes: Record<string, string> = {
    '.csv': 'text/csv',
    '.gif': 'image/gif',
    '.html': 'text/html',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.json': 'application/json',
    '.md': 'text/markdown',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain',
    '.webp': 'image/webp',
    '.zip': 'application/zip',
};
export function getTaskArtifactsRoot() {
    return resolveConfiguredPath(
        readConfigValue('TAVERN_TASK_ARTIFACTS_DIR') ?? path.join(RUNTIME_ROOT, 'artifacts')
    );
}
export async function promoteTaskAttachments(input: {
    agentId: string;
    db?: Database;
    paths: string[];
    taskId: string;
}) {
    const db = input.db ?? getDb();
    assertTaskExists(input.taskId, db);
    const workspaceRoot = await resolveAgentWorkspace(input.agentId, db);
    const taskFolder = taskArtifactsFolder(input.taskId);
    const promoted: AgentRuntimeTaskAttachment[] = [];
    for (const requestedPath of input.paths) {
        const sourcePath = normalizeWorkspacePath(requestedPath);
        const sourceFile = await resolveWorkspaceFile(workspaceRoot, sourcePath);
        const filename = path.posix.basename(sourcePath);
        const stat = await fs.stat(sourceFile).catch(() => null);
        if (!stat?.isFile()) {
            throw new Error(`Attachment source file does not exist: ${sourcePath}`);
        }
        await fs.mkdir(taskFolder, { recursive: true });
        const existing = findAttachmentByFilename(input.taskId, filename, db);
        const destination = path.join(taskFolder, filename);
        const temporary = path.join(taskFolder, `.promoting-${randomUUID()}`);
        await fs.copyFile(sourceFile, temporary);
        if (existing) {
            await fs.rm(path.join(taskFolder, existing.filename), { force: true });
        }
        await fs.rename(temporary, destination);

        const attachment = saveAttachment(
            {
                byteSize: stat.size,
                filename,
                id: existing?.id ?? `att_${randomUUID()}`,
                mediaType: mediaTypeForFilename(filename),
                promotedAt: new Date().toISOString(),
                sourcePath,
                taskId: input.taskId,
            },
            db
        );
        promoted.push(attachment);
    }
    if (promoted.length > 0) {
        touchTask(input.taskId, db);
        publishTaskUpdated(input.taskId);
    }
    return promoted;
}

export async function materializeTaskAttachments(input: {
    agentId: string;
    db?: Database;
    taskId: string;
}) {
    const db = input.db ?? getDb();
    const task = db
        .prepare('SELECT number FROM tasks WHERE id = $id')
        .get(namedParams({ id: input.taskId })) as { number: number } | null;
    if (!task) {
        throw new Error(`Task "${input.taskId}" does not exist.`);
    }
    const attachments = listTaskAttachments(input.taskId, db);
    if (attachments.length === 0) {
        return [];
    }

    const workspaceRoot = await resolveAgentWorkspace(input.agentId, db);
    const relativeFolder = `workbench/tasks/T-${task.number}`;
    const destinationFolder = path.join(workspaceRoot, ...relativeFolder.split('/'));
    await fs.mkdir(destinationFolder, { recursive: true });
    const materializationRoot = await fs.realpath(destinationFolder);
    if (!isPathInside(materializationRoot, workspaceRoot)) {
        throw new Error('Task workbench path must stay inside the agent workspace.');
    }
    for (const attachment of attachments) {
        await fs.copyFile(
            path.join(taskArtifactsFolder(input.taskId), attachment.filename),
            path.join(materializationRoot, attachment.filename)
        );
    }
    return attachments.map((attachment) => `${relativeFolder}/${attachment.filename}`);
}

export async function readTaskAttachment(taskId: string, attachmentId: string, db = getDb()) {
    const attachment = findAttachment(taskId, attachmentId, db);
    if (!attachment) {
        return null;
    }
    const content = await fs.readFile(path.join(taskArtifactsFolder(taskId), attachment.filename));
    return agentRuntimeTaskAttachmentContentSchema.parse({
        contentBase64: content.toString('base64'),
        filename: attachment.filename,
        mediaType: attachment.mediaType,
    });
}

export async function deleteTaskAttachment(taskId: string, attachmentId: string, db = getDb()) {
    const attachment = findAttachment(taskId, attachmentId, db);
    if (!attachment) {
        return false;
    }
    await fs.rm(path.join(taskArtifactsFolder(taskId), attachment.filename), { force: true });
    db.prepare('DELETE FROM task_attachments WHERE id = $id AND task_id = $taskId').run(
        namedParams({ id: attachmentId, taskId })
    );
    touchTask(taskId, db);
    publishTaskUpdated(taskId);
    return true;
}

export function deleteTaskArtifacts(taskId: string) {
    rmSync(taskArtifactsFolder(taskId), { force: true, recursive: true });
}

export function listTaskAttachments(taskId: string, db: Database = getDb()) {
    const rows = db
        .prepare('SELECT * FROM task_attachments WHERE task_id = $taskId ORDER BY lower(filename)')
        .all(namedParams({ taskId })) as AttachmentRow[];
    return rows.map(rowToAttachment);
}

export function loadAttachmentsForTasks(taskIds: string[], db: Database = getDb()) {
    const result = new Map<string, AgentRuntimeTaskAttachment[]>();
    if (taskIds.length === 0) {
        return result;
    }
    const placeholders = taskIds.map(() => '?').join(', ');
    const rows = db
        .prepare(
            `SELECT * FROM task_attachments
             WHERE task_id IN (${placeholders})
             ORDER BY task_id, lower(filename)`
        )
        .all(...taskIds) as AttachmentRow[];
    for (const row of rows) {
        const attachments = result.get(row.task_id) ?? [];
        attachments.push(rowToAttachment(row));
        result.set(row.task_id, attachments);
    }
    return result;
}

function saveAttachment(
    input: AgentRuntimeTaskAttachment & { taskId: string },
    db: Database
): AgentRuntimeTaskAttachment {
    db.prepare(
        `INSERT INTO task_attachments (
            id, task_id, filename, media_type, byte_size, source_path, promoted_at
         ) VALUES (
            $id, $taskId, $filename, $mediaType, $byteSize, $sourcePath, $promotedAt
         )
         ON CONFLICT(id) DO UPDATE SET
            filename = excluded.filename,
            media_type = excluded.media_type,
            byte_size = excluded.byte_size,
            source_path = excluded.source_path,
            promoted_at = excluded.promoted_at`
    ).run(namedParams(input));
    return agentRuntimeTaskAttachmentSchema.parse(input);
}

function findAttachmentByFilename(taskId: string, filename: string, db: Database) {
    const row = db
        .prepare(
            'SELECT * FROM task_attachments WHERE task_id = $taskId AND lower(filename) = lower($filename)'
        )
        .get(namedParams({ filename, taskId })) as AttachmentRow | null;
    return row ? rowToAttachment(row) : null;
}

function findAttachment(taskId: string, attachmentId: string, db: Database) {
    const row = db
        .prepare('SELECT * FROM task_attachments WHERE task_id = $taskId AND id = $attachmentId')
        .get(namedParams({ attachmentId, taskId })) as AttachmentRow | null;
    return row ? rowToAttachment(row) : null;
}

function rowToAttachment(row: AttachmentRow) {
    return agentRuntimeTaskAttachmentSchema.parse({
        byteSize: row.byte_size,
        filename: row.filename,
        id: row.id,
        mediaType: row.media_type,
        promotedAt: row.promoted_at,
        sourcePath: row.source_path,
    });
}

async function resolveAgentWorkspace(agentId: string, db: Database) {
    const agent = getStoredAgent(agentId, db);
    if (!agent) {
        throw new Error(`Agent "${agentId}" does not exist.`);
    }
    return await fs.realpath(agent.workspaceFolder).catch(() => {
        throw new Error(`Agent workspace does not exist: ${agent.workspaceFolder}`);
    });
}

async function resolveWorkspaceFile(workspaceRoot: string, relativePath: string) {
    const candidate = path.resolve(workspaceRoot, ...relativePath.split('/'));
    const realPath = await fs.realpath(candidate).catch(() => null);
    if (!realPath) {
        throw new Error(`Attachment source file does not exist: ${relativePath}`);
    }
    if (!isPathInside(realPath, workspaceRoot)) {
        throw new Error(`Attachment path must stay inside the workspace: ${relativePath}`);
    }
    return realPath;
}

function normalizeWorkspacePath(value: string) {
    const normalized = value.trim().replaceAll('\\', '/');
    if (!normalized) {
        throw new Error('Attachment workspace path is required.');
    }
    if (normalized.startsWith('/') || /^[A-Za-z]:\//u.test(normalized)) {
        throw new Error(`Attachment path must be workspace-relative: ${value}`);
    }
    const segments = normalized.split('/');
    if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
        throw new Error(`Attachment path must stay inside the workspace: ${value}`);
    }
    return path.posix.normalize(normalized);
}

function taskArtifactsFolder(taskId: string) {
    if (!taskId || taskId === '.' || taskId === '..' || /[\\/]/u.test(taskId)) {
        throw new Error('Invalid task id for artifact storage.');
    }
    return path.join(getTaskArtifactsRoot(), 'tasks', taskId);
}

function mediaTypeForFilename(filename: string) {
    return mediaTypes[path.extname(filename).toLowerCase()] ?? null;
}

function assertTaskExists(taskId: string, db: Database) {
    const row = db.prepare('SELECT 1 FROM tasks WHERE id = $id').get(namedParams({ id: taskId }));
    if (!row) {
        throw new Error(`Task "${taskId}" does not exist.`);
    }
}

function touchTask(taskId: string, db: Database) {
    db.prepare('UPDATE tasks SET updated_at = $now WHERE id = $taskId').run(
        namedParams({ now: new Date().toISOString(), taskId })
    );
}

function isPathInside(filePath: string, root: string) {
    return filePath === root || filePath.startsWith(`${root}${path.sep}`);
}
