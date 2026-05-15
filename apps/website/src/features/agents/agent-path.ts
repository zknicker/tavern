export function buildAgentPath(_agentId?: string) {
    return '/dashboard/agent';
}

export function buildAgentSettingsPath(_agentId?: string) {
    return '/dashboard/settings/agent';
}

export function getActiveAgentPage(pathname: string) {
    const segments = pathname.split('/').filter(Boolean);

    if (!(segments[0] === 'dashboard' && segments[1] === 'agent')) {
        return null;
    }

    if (segments[2] !== undefined) {
        return null;
    }

    return {
        agentId: 'primary',
        page: 'home' as const,
    };
}
