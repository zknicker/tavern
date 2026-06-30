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

export const settingsNavItems = [
    {
        icon: ComputerTerminal01Icon,
        id: 'agent-runtime',
        label: 'Tavern Runtime',
        to: '/dashboard/settings/agent-runtime',
    },
    {
        icon: PaintBrush03Icon,
        id: 'appearance',
        label: 'Appearance',
        to: '/dashboard/settings/appearance',
    },
    {
        icon: SystemUpdate01Icon,
        id: 'updates',
        label: 'Updates',
        to: '/dashboard/settings/updates',
    },
    {
        icon: Activity01Icon,
        id: 'stats',
        label: 'Stats',
        to: '/dashboard/settings/stats',
    },
    {
        icon: ChatIcon,
        id: 'sessions',
        label: 'Sessions',
        to: '/dashboard/settings/sessions',
    },
    {
        icon: FileEditIcon,
        id: 'agent',
        label: 'Agent',
        to: '/dashboard/settings/agent',
    },
    {
        icon: FileEditIcon,
        id: 'notes-md',
        label: 'NOTES.md',
        to: '/dashboard/settings/notes-md',
    },
    {
        icon: FileEditIcon,
        id: 'soul-md',
        label: 'SOUL.md',
        to: '/dashboard/settings/soul-md',
    },
    {
        icon: ZapIcon,
        id: 'skills',
        label: 'Skills',
        to: '/dashboard/settings/skills',
    },
    {
        icon: ToolsIcon,
        id: 'tools',
        label: 'Tools',
        to: '/dashboard/settings/tools',
    },
    {
        icon: PuzzleIcon,
        id: 'plugins',
        label: 'Plugins',
        to: '/dashboard/settings/plugins',
    },
    {
        icon: ChatIcon,
        id: 'channels',
        label: 'Channels',
        to: '/dashboard/settings/channels',
    },
    {
        icon: PlugSocketIcon,
        id: 'mcp',
        label: 'MCP',
        to: '/dashboard/settings/mcp',
    },
    {
        icon: AiBrain01Icon,
        id: 'models',
        label: 'Models',
        to: '/dashboard/settings/models',
    },
    {
        icon: Database02Icon,
        id: 'memories',
        label: 'Memory',
        to: '/dashboard/settings/memories',
    },
    {
        icon: HourglassIcon,
        id: 'jobs',
        label: 'Jobs',
        to: '/dashboard/settings/jobs',
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
