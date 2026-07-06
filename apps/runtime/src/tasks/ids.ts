export function createTaskId(): string {
    return `tsk_${crypto.randomUUID()}`;
}
