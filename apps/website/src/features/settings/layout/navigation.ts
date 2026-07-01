import type { IconSvgElement } from '@hugeicons/react';
import {
    Activity01Icon,
    AiBrain01Icon,
    ChatIcon,
    ComputerTerminal01Icon,
    Database02Icon,
    FileEditIcon,
    HourglassIcon,
    PaintBrush03Icon,
    PuzzleIcon,
    SystemUpdate01Icon,
    UserCircleIcon,
    ZapIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import { appRoutes } from '../../../lib/app-routes.ts';
import type { AgentSettingsTab } from '../../agents/agent-path.ts';

export const staticSettingsNavItems = [
    {
        icon: ComputerTerminal01Icon,
        id: 'agent-runtime',
        label: 'Tavern Runtime',
        to: appRoutes.settingsAgentRuntime,
    },
    {
        icon: PaintBrush03Icon,
        id: 'appearance',
        label: 'Appearance',
        to: appRoutes.settingsAppearance,
    },
    {
        icon: UserCircleIcon,
        id: 'profile',
        label: 'Profile',
        to: appRoutes.settingsProfile,
    },
    {
        icon: SystemUpdate01Icon,
        id: 'updates',
        label: 'Updates',
        to: appRoutes.settingsUpdates,
    },
    {
        icon: Activity01Icon,
        id: 'stats',
        label: 'Stats',
        to: appRoutes.settingsStats,
    },
    {
        icon: ChatIcon,
        id: 'sessions',
        label: 'Sessions',
        to: appRoutes.settingsSessions,
    },
    {
        icon: AiBrain01Icon,
        id: 'models',
        label: 'Models',
        to: appRoutes.settingsModels,
    },
    {
        icon: HourglassIcon,
        id: 'jobs',
        label: 'Jobs',
        to: appRoutes.settingsJobs,
    },
] as const satisfies ReadonlyArray<{
    icon: IconSvgElement;
    id: string;
    label: string;
    to: string;
}>;

export const agentSettingsNavItems = [
    {
        icon: FileEditIcon,
        id: 'agent-general',
        label: 'General',
        tab: 'general',
    },
    {
        icon: ZapIcon,
        id: 'agent-skills',
        label: 'Skills',
        tab: 'skills',
    },
    {
        icon: PuzzleIcon,
        id: 'agent-plugins',
        label: 'Plugins',
        tab: 'plugins',
    },
    {
        icon: ChatIcon,
        id: 'agent-channels',
        label: 'Channels',
        tab: 'channels',
    },
    {
        icon: Database02Icon,
        id: 'agent-memory',
        label: 'Memory',
        tab: 'memory',
    },
] as const satisfies ReadonlyArray<{
    icon: IconSvgElement;
    id: string;
    label: string;
    tab: AgentSettingsTab;
}>;

export const settingsNavItems = [...staticSettingsNavItems, ...agentSettingsNavItems] as const;

export const settingsNavSections = [
    {
        id: 'general',
        itemIds: ['agent-runtime', 'appearance', 'profile', 'updates', 'models'],
        label: 'General',
    },
    {
        id: 'activity',
        itemIds: ['sessions', 'jobs', 'stats'],
        label: 'Activity',
    },
] as const;

export type SettingsNavItem = (typeof settingsNavItems)[number];
export type SettingsRouteTab = SettingsNavItem['id'];

export function resolveAgentSettingsNavOpen({
    isAgentActive,
    manualOpen,
}: {
    isAgentActive: boolean;
    manualOpen: boolean | null;
}) {
    return manualOpen ?? isAgentActive;
}
