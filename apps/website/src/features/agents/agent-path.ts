import { appRoutes } from '../../lib/app-routes.ts';

export const agentSettingsTabs = ['general', 'skills', 'plugins', 'channels'] as const;

export type AgentSettingsTab = (typeof agentSettingsTabs)[number];

export function buildAgentPath(_agentId?: string) {
    return appRoutes.settingsSessions;
}

export function buildAgentSettingsPath(agentId?: string, tab: AgentSettingsTab = 'general') {
    if (!agentId) {
        return appRoutes.settingsAgent;
    }

    return `/settings/agents/${encodeURIComponent(agentId)}/${tab}`;
}

export function getActiveAgentPage(pathname: string) {
    const match = /^\/settings\/agents\/([^/]+)\/([^/]+)/u.exec(pathname);

    if (!match) {
        return null;
    }

    const tab = agentSettingsTabs.find((entry) => entry === match[2]);

    if (!tab) {
        return null;
    }

    return {
        agentId: decodeURIComponent(match[1] ?? ''),
        tab,
    };
}
