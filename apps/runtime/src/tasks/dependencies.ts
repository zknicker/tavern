import type { AgentRuntimeTaskKind } from '@tavern/api';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';

interface TaskDependencyRow {
    depends_on_task_id: string;
    task_id: string;
}

interface TaskIdentityRow {
    id: string;
    kind: AgentRuntimeTaskKind;
    number: number;
}

interface TaskEdgeRow {
    depends_on_task_id: string;
    depends_on_task_number: number;
    task_id: string;
    task_number: number;
}

export function loadBlockedByMap(taskIds: string[], db: Database): Map<string, string[]> {
    const ids = uniqueIds(taskIds);
    const blockedBy = new Map(ids.map((id) => [id, [] as string[]]));
    if (ids.length === 0) {
        return blockedBy;
    }

    const rows = db
        .prepare(
            `SELECT td.task_id, td.depends_on_task_id
             FROM task_dependencies td
             JOIN tasks dep ON dep.id = td.depends_on_task_id
             WHERE td.task_id IN (${placeholders(ids)})
             ORDER BY td.task_id ASC, dep.number ASC`
        )
        .all(...ids) as TaskDependencyRow[];

    for (const row of rows) {
        blockedBy.get(row.task_id)?.push(row.depends_on_task_id);
    }

    return blockedBy;
}

export function replaceTaskDependencies(
    input: {
        blockedBy: string[];
        taskId: string;
        taskKind: AgentRuntimeTaskKind;
        taskNumber: number;
    },
    db: Database
): void {
    const blockedBy = uniqueIds(input.blockedBy);
    validateTaskDependencies({ ...input, blockedBy }, db);

    db.prepare('DELETE FROM task_dependencies WHERE task_id = $taskId').run(
        namedParams({ taskId: input.taskId })
    );

    const insert = db.prepare(
        `INSERT INTO task_dependencies (task_id, depends_on_task_id)
         VALUES ($taskId, $dependsOnTaskId)`
    );
    for (const dependsOnTaskId of blockedBy) {
        insert.run(namedParams({ dependsOnTaskId, taskId: input.taskId }));
    }
}

function validateTaskDependencies(
    input: {
        blockedBy: string[];
        taskId: string;
        taskKind: AgentRuntimeTaskKind;
        taskNumber: number;
    },
    db: Database
): void {
    if (input.blockedBy.length === 0) {
        return;
    }

    if (input.taskKind !== 'task') {
        throw new Error(`T-${input.taskNumber} is an epic and cannot have dependencies.`);
    }

    if (input.blockedBy.includes(input.taskId)) {
        throw new Error('A task cannot depend on itself.');
    }

    const dependencyRows = loadTaskIdentities(input.blockedBy, db);
    for (const dependsOnTaskId of input.blockedBy) {
        const dependency = dependencyRows.get(dependsOnTaskId);
        if (!dependency) {
            throw new Error(`Missing dependency task ${dependsOnTaskId}.`);
        }
        if (dependency.kind !== 'task') {
            throw new Error(`T-${dependency.number} is an epic and cannot be a dependency.`);
        }
    }

    const cycle = findDependencyCycle(input, db);
    if (cycle) {
        throw new Error(`Dependency cycle rejected: ${cycle}.`);
    }
}

function findDependencyCycle(
    input: { blockedBy: string[]; taskId: string; taskNumber: number },
    db: Database
): string | null {
    const edges = db
        .prepare(
            `SELECT td.task_id, task.number AS task_number,
                    td.depends_on_task_id, depends_on.number AS depends_on_task_number
             FROM task_dependencies td
             JOIN tasks task ON task.id = td.task_id
             JOIN tasks depends_on ON depends_on.id = td.depends_on_task_id`
        )
        .all() as TaskEdgeRow[];
    const graph = new Map<string, string[]>();
    const numbers = new Map<string, number>([[input.taskId, input.taskNumber]]);

    for (const edge of edges) {
        const dependencies = graph.get(edge.task_id) ?? [];
        dependencies.push(edge.depends_on_task_id);
        graph.set(edge.task_id, dependencies);
        numbers.set(edge.task_id, edge.task_number);
        numbers.set(edge.depends_on_task_id, edge.depends_on_task_number);
    }

    graph.set(input.taskId, input.blockedBy);

    for (const dependsOnTaskId of input.blockedBy) {
        const cycle = walkCycle(input.taskId, dependsOnTaskId, graph, [input.taskId]);
        if (cycle) {
            return cycle.map((taskId) => formatTaskNumber(taskId, numbers)).join(' -> ');
        }
    }

    return null;
}

function walkCycle(
    targetTaskId: string,
    currentTaskId: string,
    graph: Map<string, string[]>,
    path: string[],
    seen: Set<string> = new Set()
): string[] | null {
    const nextPath = [...path, currentTaskId];
    if (currentTaskId === targetTaskId) {
        return nextPath;
    }
    if (seen.has(currentTaskId)) {
        return null;
    }

    seen.add(currentTaskId);
    for (const dependsOnTaskId of graph.get(currentTaskId) ?? []) {
        const cycle = walkCycle(targetTaskId, dependsOnTaskId, graph, nextPath, new Set(seen));
        if (cycle) {
            return cycle;
        }
    }

    return null;
}

function loadTaskIdentities(taskIds: string[], db: Database): Map<string, TaskIdentityRow> {
    const ids = uniqueIds(taskIds);
    if (ids.length === 0) {
        return new Map();
    }

    const rows = db
        .prepare(`SELECT id, kind, number FROM tasks WHERE id IN (${placeholders(ids)})`)
        .all(...ids) as TaskIdentityRow[];
    return new Map(rows.map((row) => [row.id, row]));
}

function uniqueIds(ids: string[]) {
    return Array.from(new Set(ids));
}

function placeholders(values: unknown[]) {
    return values.map(() => '?').join(', ');
}

function formatTaskNumber(taskId: string, numbers: Map<string, number>) {
    const number = numbers.get(taskId);
    return number === undefined ? taskId : `T-${number}`;
}
