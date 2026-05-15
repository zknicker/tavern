export function toIsoString(value: Date | string) {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function toNullableIsoString(value: Date | string | null) {
    if (value === null) {
        return null;
    }

    return toIsoString(value);
}
