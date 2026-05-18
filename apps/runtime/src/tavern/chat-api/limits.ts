export function clampLimit(limit: number | undefined) {
    return Math.min(Math.max(limit ?? 100, 1), 500);
}
