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
    PlugSocketIcon,
    PuzzleIcon,
    SystemUpdate01Icon,
    ToolsIcon,
    ZapIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import { appRoutes } from '../../../lib/app-routes.ts';

export const settingsNavItems = [
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
        icon: FileEditIcon,
        id: 'agent',
        label: 'Agent',
        to: appRoutes.settingsAgent,
    },
    {
        icon: FileEditIcon,
        id: 'notes-md',
        label: 'NOTES.md',
        to: appRoutes.settingsNotesMd,
    },
    {
        icon: FileEditIcon,
        id: 'soul-md',
        label: 'SOUL.md',
        to: appRoutes.settingsSoulMd,
    },
    {
        icon: ZapIcon,
        id: 'skills',
        label: 'Skills',
        to: appRoutes.settingsSkills,
    },
    {
        icon: ToolsIcon,
        id: 'tools',
        label: 'Tools',
        to: appRoutes.settingsTools,
    },
    {
        icon: PuzzleIcon,
        id: 'plugins',
        label: 'Plugins',
        to: appRoutes.settingsPlugins,
    },
    {
        icon: ChatIcon,
        id: 'channels',
        label: 'Channels',
        to: appRoutes.settingsChannels,
    },
    {
        icon: PlugSocketIcon,
        id: 'mcp',
        label: 'MCP',
        to: appRoutes.settingsMcp,
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

export const settingsNavSections = [
    {
        id: 'general',
        itemIds: ['agent-runtime', 'appearance', 'updates', 'models'],
        label: 'General',
    },
    {
        id: 'agent',
        itemIds: [
            'agent',
            'notes-md',
            'soul-md',
            'skills',
            'tools',
            'plugins',
            'channels',
            'mcp',
            'memories',
        ],
        label: 'Agent',
    },
    {
        id: 'activity',
        itemIds: ['sessions', 'jobs', 'stats'],
        label: 'Activity',
    },
] as const;

export type SettingsNavItem = (typeof settingsNavItems)[number];
export type SettingsRouteTab = SettingsNavItem['id'];
