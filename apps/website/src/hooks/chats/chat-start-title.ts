const maxChatDisplayNameLength = 70;

export function buildStartedChatDisplayName(content: string) {
    const normalized = content.replace(/\s+/g, ' ').trim();

    if (normalized.length <= maxChatDisplayNameLength) {
        return normalized;
    }

    return `${normalized.slice(0, maxChatDisplayNameLength - 3).trimEnd()}...`;
}
