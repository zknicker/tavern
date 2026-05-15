export function createChatTiming(label: string, fields: Record<string, string | undefined> = {}) {
    const startedAt = performance.now();
    let previousAt = startedAt;

    return (step: string, moreFields: Record<string, string | undefined> = {}) => {
        const now = performance.now();
        const elapsedMs = Math.round(now - startedAt);
        const stepMs = Math.round(now - previousAt);
        previousAt = now;

        console.info('[tavern] chat timing', {
            ...fields,
            ...moreFields,
            elapsedMs,
            label,
            step,
            stepMs,
        });
    };
}
