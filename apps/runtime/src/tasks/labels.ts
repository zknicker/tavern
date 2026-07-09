import type {
    AgentRuntimeCreateTaskLabel,
    AgentRuntimeTaskLabel,
    AgentRuntimeTaskLabelColor,
    AgentRuntimeTaskLabelWithCount,
    AgentRuntimeUpdateTaskLabel,
} from '@tavern/api';
import { agentRuntimeTaskLabelSchema } from '@tavern/api';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';

const labelColors = [
    'red',
    'orange',
    'amber',
    'green',
    'teal',
    'blue',
    'purple',
    'pink',
    'gray',
] as const satisfies readonly AgentRuntimeTaskLabelColor[];

interface LabelRow {
    color: AgentRuntimeTaskLabelColor;
    id: string;
    name: string;
}

interface LabelWithCountRow extends LabelRow {
    task_count: number;
}

export function listLabels(db: Database = getDb()): AgentRuntimeTaskLabelWithCount[] {
    const rows = db
        .prepare(
            `SELECT l.id, l.name, l.color, COUNT(tl.task_id) AS task_count
             FROM labels l
             LEFT JOIN task_labels tl ON tl.label_id = l.id
             GROUP BY l.id
             ORDER BY lower(l.name) ASC, l.name ASC`
        )
        .all() as LabelWithCountRow[];

    return rows.map((row) => ({
        color: row.color,
        id: row.id,
        name: row.name,
        taskCount: row.task_count,
    }));
}

export function createLabel(
    input: AgentRuntimeCreateTaskLabel,
    db: Database = getDb()
): AgentRuntimeTaskLabel {
    const name = normalizeLabelName(input.name);
    const now = new Date().toISOString();
    const label = {
        color: input.color ?? colorForLabelName(name),
        id: createLabelId(),
        name,
    };

    try {
        db.prepare(
            `INSERT INTO labels (id, name, color, created_at, updated_at)
             VALUES ($id, $name, $color, $now, $now)`
        ).run(namedParams({ ...label, now }));
    } catch (error) {
        throwDuplicateLabelError(error, name);
    }

    return agentRuntimeTaskLabelSchema.parse(label);
}

export function updateLabel(
    labelId: string,
    input: AgentRuntimeUpdateTaskLabel,
    db: Database = getDb()
): AgentRuntimeTaskLabel | null {
    const existing = getLabel(labelId, db);
    if (!existing) {
        return null;
    }

    const next = {
        color: input.color ?? existing.color,
        name: input.name === undefined ? existing.name : normalizeLabelName(input.name),
    };

    try {
        db.prepare(
            `UPDATE labels
             SET name = $name, color = $color, updated_at = $now
             WHERE id = $id`
        ).run(namedParams({ ...next, id: labelId, now: new Date().toISOString() }));
    } catch (error) {
        throwDuplicateLabelError(error, next.name);
    }

    return getLabel(labelId, db);
}

export function deleteLabel(labelId: string, db: Database = getDb()): boolean {
    const result = db
        .prepare('DELETE FROM labels WHERE id = $id')
        .run(namedParams({ id: labelId }));
    return result.changes > 0;
}

export function resolveLabelNames(names: string[], db: Database = getDb()): string[] {
    const normalizedNames = uniqueNormalizedNames(names);
    if (normalizedNames.length === 0) {
        return [];
    }

    const labelIds: string[] = [];
    for (const name of normalizedNames) {
        const existing = findLabelByName(name, db);
        if (existing) {
            labelIds.push(existing.id);
            continue;
        }
        labelIds.push(createLabel({ name }, db).id);
    }

    return labelIds;
}

export function replaceTaskLabels(taskId: string, labelIds: string[], db: Database): void {
    db.prepare('DELETE FROM task_labels WHERE task_id = $taskId').run(namedParams({ taskId }));

    const insert = db.prepare(
        `INSERT OR IGNORE INTO task_labels (task_id, label_id)
         VALUES ($taskId, $labelId)`
    );
    for (const labelId of labelIds) {
        insert.run(namedParams({ labelId, taskId }));
    }
}

export function loadLabelsForTasks(
    taskIds: string[],
    db: Database
): Map<string, AgentRuntimeTaskLabel[]> {
    const ids = Array.from(new Set(taskIds));
    const labels = new Map(ids.map((id) => [id, [] as AgentRuntimeTaskLabel[]]));
    if (ids.length === 0) {
        return labels;
    }

    const rows = db
        .prepare(
            `SELECT tl.task_id, l.id, l.name, l.color
             FROM task_labels tl
             JOIN labels l ON l.id = tl.label_id
             WHERE tl.task_id IN (${placeholders(ids)})
             ORDER BY tl.task_id ASC, lower(l.name) ASC, l.name ASC`
        )
        .all(...ids) as Array<LabelRow & { task_id: string }>;

    for (const row of rows) {
        labels.get(row.task_id)?.push(
            agentRuntimeTaskLabelSchema.parse({
                color: row.color,
                id: row.id,
                name: row.name,
            })
        );
    }

    return labels;
}

export function colorForLabelName(name: string): AgentRuntimeTaskLabelColor {
    let hash = 0;
    for (const char of normalizeLabelName(name).toLowerCase()) {
        hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    }
    return labelColors[hash % labelColors.length] ?? 'gray';
}

export function normalizeLabelName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
        throw new Error('Label name cannot be empty.');
    }
    return trimmed;
}

function getLabel(labelId: string, db: Database): AgentRuntimeTaskLabel | null {
    const row = db
        .prepare('SELECT id, name, color FROM labels WHERE id = $id')
        .get(namedParams({ id: labelId })) as LabelRow | null;
    return row ? agentRuntimeTaskLabelSchema.parse(row) : null;
}

function findLabelByName(name: string, db: Database): LabelRow | null {
    return db
        .prepare('SELECT id, name, color FROM labels WHERE lower(name) = lower($name)')
        .get(namedParams({ name })) as LabelRow | null;
}

function uniqueNormalizedNames(names: string[]) {
    const byKey = new Map<string, string>();
    for (const name of names) {
        const normalized = normalizeLabelName(name);
        const key = normalized.toLowerCase();
        if (!byKey.has(key)) {
            byKey.set(key, normalized);
        }
    }
    return Array.from(byKey.values());
}

function createLabelId() {
    return `lbl_${crypto.randomUUID()}`;
}

function placeholders(values: unknown[]) {
    return values.map(() => '?').join(', ');
}

function throwDuplicateLabelError(error: unknown, name: string): never {
    if (error instanceof Error && error.message.toLowerCase().includes('unique')) {
        throw new Error(`Label "${name}" already exists.`);
    }
    throw error;
}
