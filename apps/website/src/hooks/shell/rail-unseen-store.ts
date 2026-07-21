export function parseTasksLastSeenAt(value: string | null) {
    const timestamp = Number(value);
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0;
}

export function hasTasksUpdatedAfter(tasks: readonly { updatedAt: string }[], lastSeenAt: number) {
    return tasks.some((task) => {
        const updatedAt = Date.parse(task.updatedAt);
        return Number.isFinite(updatedAt) && updatedAt > lastSeenAt;
    });
}
