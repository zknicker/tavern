import type { IconSvgElement } from '@hugeicons/react';
import {
    AiBrain01Icon,
    ArrowLeft01Icon,
    ChatIcon,
    ComputerTerminal01Icon,
    Database02Icon,
    HourglassIcon,
    PaintBrush03Icon,
    SystemUpdate01Icon,
    UserAccountIcon,
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
        icon: UserAccountIcon,
        id: 'participants',
        label: 'Profile',
        to: '/dashboard/settings/participants',
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
        icon: ChatIcon,
        id: 'sessions',
        label: 'Sessions',
        to: '/dashboard/settings/sessions',
    },
    {
        icon: ZapIcon,
        id: 'skills',
        label: 'Skills & Plugins',
        to: '/dashboard/settings/skills',
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
        label: 'Memories',
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
        id: 'tavern',
        items: settingsNavItems,
        label: 'Tavern',
    },
] as const;

export const backToAppIcon = ArrowLeft01Icon;

export type SettingsNavItem = (typeof settingsNavItems)[number];
export type SettingsRouteTab = SettingsNavItem['id'];
