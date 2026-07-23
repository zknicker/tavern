import type { TavernTaskLabel } from '@tavern/api';
import { getDb } from '../../db/connection';
import type { Database } from '../../db/sqlite';
import { namedParams } from '../../db/sqlite';

// Shared task-label catalog. Task rows reference labels by id; a deleted
// label simply stops resolving, so reads self-heal without a scan.

export const taskLabelColors = [
    'red',
    'orange',
    'amber',
    'green',
    'teal',
    'blue',
    'purple',
    'pink',
    'gray',
] as const;

export type TaskLabelColor = (typeof taskLabelColors)[number];

export function listLabels(db: Database = getDb()): TavernTaskLabel[] {
    return db
        .prepare('SELECT id, name, color FROM labels ORDER BY lower(name)')
        .all() as TavernTaskLabel[];
}

export function labelsByIds(ids: string[], db: Database = getDb()): TavernTaskLabel[] {
    if (ids.length === 0) {
        return [];
    }
    const byId = new Map(listLabels(db).map((label) => [label.id, label]));
    return ids.flatMap((id) => {
        const label = byId.get(id);
        return label ? [label] : [];
    });
}

/** Resolves label names to ids, creating missing labels inline. */
export function ensureLabels(names: string[], db: Database = getDb()): string[] {
    const now = new Date().toISOString();
    const ids: string[] = [];
    for (const rawName of names) {
        const name = rawName.trim();
        if (!name) {
            continue;
        }
        const existing = db
            .prepare('SELECT id FROM labels WHERE lower(name) = lower($name)')
            .get(namedParams({ name })) as { id: string } | null;
        if (existing) {
            ids.push(existing.id);
            continue;
        }
        const id = createLabelId();
        db.prepare(
            `INSERT INTO labels (id, name, color, created_at, updated_at)
             VALUES ($id, $name, $color, $now, $now)`
        ).run(namedParams({ color: colorForLabelName(name), id, name, now }));
        ids.push(id);
    }
    return [...new Set(ids)];
}

export function updateLabel(
    input: { color?: TaskLabelColor; labelId: string; name?: string },
    db: Database = getDb()
): TavernTaskLabel | null {
    const existing = db
        .prepare('SELECT id, name, color FROM labels WHERE id = $labelId')
        .get(namedParams({ labelId: input.labelId })) as TavernTaskLabel | null;
    if (!existing) {
        return null;
    }
    db.prepare(
        'UPDATE labels SET name = $name, color = $color, updated_at = $now WHERE id = $labelId'
    ).run(
        namedParams({
            color: input.color ?? existing.color,
            labelId: input.labelId,
            name: input.name?.trim() || existing.name,
            now: new Date().toISOString(),
        })
    );
    return db
        .prepare('SELECT id, name, color FROM labels WHERE id = $labelId')
        .get(namedParams({ labelId: input.labelId })) as TavernTaskLabel;
}

export function deleteLabel(labelId: string, db: Database = getDb()): void {
    db.prepare('DELETE FROM labels WHERE id = $labelId').run(namedParams({ labelId }));
}

function colorForLabelName(name: string): TaskLabelColor {
    let hash = 0;
    for (const char of name.trim().toLowerCase()) {
        hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    }
    return taskLabelColors[hash % taskLabelColors.length] ?? 'gray';
}

function createLabelId() {
    return `lbl_${crypto.randomUUID().replaceAll('-', '')}`;
}
