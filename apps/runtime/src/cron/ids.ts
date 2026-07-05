export function createCronRunId(): string {
    return `crr_${crypto.randomUUID()}`;
}

export function createCronMessageId(runId: string): string {
    return `msg_${sanitizeId(runId)}_request`;
}

export function createCronDeliveryId(runId: string): string {
    return `del_${sanitizeId(runId)}`;
}

function sanitizeId(value: string): string {
    return value.replace(/[^A-Za-z0-9_-]/g, '_');
}
