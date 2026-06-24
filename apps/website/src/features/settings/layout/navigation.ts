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
    SystemUpdate01Icon,
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
        icon: PlugSocketIcon,
        id: 'toolsets',
        label: 'Toolsets',
        to: '/dashboard/settings/toolsets',
    },
    {
        icon: PlugSocketIcon,
        id: 'integrations',
        label: 'Integrations',
        to: '/dashboard/settings/integrations',
    },
    {
        icon: PlugSocketIcon,
        id: 'connectors',
        label: 'Connectors',
        to: '/dashboard/settings/connectors',
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
        label: 'Vault',
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
            'toolsets',
            'integrations',
            'connectors',
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
