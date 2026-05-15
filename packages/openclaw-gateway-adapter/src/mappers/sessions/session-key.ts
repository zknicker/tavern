export interface OpenClawSessionKeyParts {
    agentId: string | null;
    platform: string | null;
    scope: 'channel' | 'dm' | 'group' | 'topic' | null;
    target: string | null;
}

export function parseOpenClawSessionKey(key: string): OpenClawSessionKeyParts {
    const parts = key.split(':');

    if (parts[0] !== 'agent' || !(parts[1] && parts[2])) {
        return emptyOpenClawSessionKeyParts();
    }

    const [, agentId, platform] = parts;
    const scopeIndex = parts.findIndex((part, index) => index > 2 && isChatScopePart(part));

    if (scopeIndex < 0) {
        return {
            agentId,
            platform,
            scope: null,
            target: null,
        };
    }

    const rawScope = parts[scopeIndex] as 'channel' | 'direct' | 'dm' | 'group' | 'topic';
    const scope = rawScope === 'direct' ? 'dm' : rawScope;
    const targetParts = parts.slice(scopeIndex + 1);
    const targetValue = targetParts.join(':') || null;

    return {
        agentId,
        platform,
        scope,
        target: targetValue ? `${scope}:${targetValue}` : null,
    };
}

function emptyOpenClawSessionKeyParts(): OpenClawSessionKeyParts {
    return {
        agentId: null,
        platform: null,
        scope: null,
        target: null,
    };
}

function isChatScopePart(value: string) {
    return (
        value === 'channel' ||
        value === 'direct' ||
        value === 'dm' ||
        value === 'group' ||
        value === 'topic'
    );
}
