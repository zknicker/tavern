export function getSessionCardDomId(sessionKey: string) {
    return `session-card-${encodeURIComponent(sessionKey)}`;
}
