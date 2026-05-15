export function formatAgentLastSeen(value: string) {
    try {
        return new Date(value).toLocaleString(undefined, {
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return value;
    }
}
