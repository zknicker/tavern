import type { IconSvgElement } from '@hugeicons/react';
import {
    Activity01Icon,
    AiBrain01Icon,
    ChatIcon,
    ComputerTerminal01Icon,
    Database02Icon,
    HourglassIcon,
    PaintBrush03Icon,
    PuzzleIcon,
    SystemUpdate01Icon,
    UserCircleIcon,
    ZapIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import { appRoutes } from '../../../lib/app-routes.ts';

export const staticSettingsNavItems = [
    {
        icon: ComputerTerminal01Icon,
        id: 'agent-runtime',
        label: 'Grotto Runtime',
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
        icon: Database02Icon,
        id: 'memories',
        label: 'Memory',
        to: appRoutes.settingsMemories,
    },
    {
        icon: ZapIcon,
        id: 'skills',
        label: 'Skills',
        to: appRoutes.settingsSkills,
    },
    {
        icon: PuzzleIcon,
        id: 'plugins',
        label: 'Plugins',
        to: appRoutes.settingsPlugins,
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

export const settingsNavItems = staticSettingsNavItems;

export const settingsNavSections = [
    {
        id: 'general',
        itemIds: [
            'agent-runtime',
            'appearance',
            'profile',
            'updates',
            'models',
            'memories',
            'skills',
            'plugins',
        ],
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
