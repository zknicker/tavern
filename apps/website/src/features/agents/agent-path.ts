import { appRoutes } from '../../lib/app-routes.ts';

export function buildAgentPath(_agentId?: string) {
    return appRoutes.settingsSessions;
}

export function buildAgentSettingsPath(_agentId?: string) {
    return appRoutes.settingsSessions;
}

export function getActiveAgentPage(_pathname: string) {
    return null;
}
