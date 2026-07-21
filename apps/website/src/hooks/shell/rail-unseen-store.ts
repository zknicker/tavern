export interface TaskSeenRevision {
    id: string;
    updatedAt: string;
}

export function parseTaskSeenRevisions(value: string | null): TaskSeenRevision[] {
    if (!value) {
        return [];
    }

    try {
        const parsed: unknown = JSON.parse(value);
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed.filter(
            (entry): entry is TaskSeenRevision =>
                Boolean(entry) &&
                typeof entry === 'object' &&
                typeof (entry as TaskSeenRevision).id === 'string' &&
                typeof (entry as TaskSeenRevision).updatedAt === 'string'
        );
    } catch {
        return [];
    }
}

export function buildTaskSeenRevisions(
    tasks: readonly { id: string; updatedAt: string }[]
): TaskSeenRevision[] {
    return tasks.map(({ id, updatedAt }) => ({ id, updatedAt }));
}

export function hasUnseenTasks(
    tasks: readonly { id: string; updatedAt: string }[],
    seenRevisions: readonly TaskSeenRevision[]
) {
    const seenUpdatedAtById = new Map(
        seenRevisions.map((revision) => [revision.id, revision.updatedAt])
    );

    return tasks.some((task) => seenUpdatedAtById.get(task.id) !== task.updatedAt);
}
