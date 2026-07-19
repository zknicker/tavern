const sessionTokenMaxAgeMs = 5 * 60 * 1000;

let currentSessionToken: { token: string; updatedAt: number } | null = null;

export function setCurrentSessionToken(token: string) {
    currentSessionToken = { token, updatedAt: Date.now() };
}

export function getCurrentSessionToken(): string | null {
    if (!currentSessionToken) {
        return null;
    }

    if (Date.now() - currentSessionToken.updatedAt > sessionTokenMaxAgeMs) {
        currentSessionToken = null;
        return null;
    }

    return currentSessionToken.token;
}
