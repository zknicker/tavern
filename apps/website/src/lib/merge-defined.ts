/** Merge patch keys into base, ignoring keys explicitly set to undefined. */
export function mergeDefined<T extends object>(base: T, patch: Partial<T>): T {
    const next = { ...base };

    for (const [key, value] of Object.entries(patch)) {
        if (value !== undefined) {
            (next as Record<string, unknown>)[key] = value;
        }
    }

    return next;
}
