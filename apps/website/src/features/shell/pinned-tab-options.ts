import type { CSSProperties } from 'react';

export const pinnedTabColorOptions = [
    { darkValue: '#94a3b8', id: 'slate', label: 'Slate', lightValue: '#475569', value: '#64748b' },
    { darkValue: '#f87171', id: 'red', label: 'Red', lightValue: '#dc2626', value: '#ef4444' },
    {
        darkValue: '#fb923c',
        id: 'orange',
        label: 'Orange',
        lightValue: '#ea580c',
        value: '#f97316',
    },
    { darkValue: '#fbbf24', id: 'amber', label: 'Amber', lightValue: '#d97706', value: '#f59e0b' },
    {
        darkValue: '#facc15',
        id: 'yellow',
        label: 'Yellow',
        lightValue: '#ca8a04',
        value: '#eab308',
    },
    { darkValue: '#a3e635', id: 'lime', label: 'Lime', lightValue: '#65a30d', value: '#84cc16' },
    { darkValue: '#4ade80', id: 'green', label: 'Green', lightValue: '#16a34a', value: '#22c55e' },
    {
        darkValue: '#34d399',
        id: 'emerald',
        label: 'Emerald',
        lightValue: '#059669',
        value: '#10b981',
    },
    { darkValue: '#2dd4bf', id: 'teal', label: 'Teal', lightValue: '#0d9488', value: '#14b8a6' },
    { darkValue: '#22d3ee', id: 'cyan', label: 'Cyan', lightValue: '#0891b2', value: '#06b6d4' },
    { darkValue: '#38bdf8', id: 'sky', label: 'Sky', lightValue: '#0284c7', value: '#0ea5e9' },
    { darkValue: '#60a5fa', id: 'blue', label: 'Blue', lightValue: '#2563eb', value: '#3b82f6' },
    {
        darkValue: '#818cf8',
        id: 'indigo',
        label: 'Indigo',
        lightValue: '#4f46e5',
        value: '#6366f1',
    },
    {
        darkValue: '#a78bfa',
        id: 'violet',
        label: 'Violet',
        lightValue: '#7c3aed',
        value: '#8b5cf6',
    },
    {
        darkValue: '#c084fc',
        id: 'purple',
        label: 'Purple',
        lightValue: '#9333ea',
        value: '#a855f7',
    },
    {
        darkValue: '#e879f9',
        id: 'fuchsia',
        label: 'Fuchsia',
        lightValue: '#c026d3',
        value: '#d946ef',
    },
    { darkValue: '#f472b6', id: 'pink', label: 'Pink', lightValue: '#db2777', value: '#ec4899' },
    { darkValue: '#fb7185', id: 'rose', label: 'Rose', lightValue: '#e11d48', value: '#f43f5e' },
] as const;

export interface PinnedTabColorTheme {
    darkValue: string;
    lightValue: string;
}

type PinnedTabColorStyle = CSSProperties & Record<`--${string}`, string>;

export function getPinnedTabColorStyle(
    color: string | null | undefined
): PinnedTabColorStyle | undefined {
    if (!color) {
        return undefined;
    }

    const theme = getPinnedTabColorTheme(color);

    return {
        '--pinned-tab-bg-active-dark': colorMix(theme.darkValue, 24),
        '--pinned-tab-bg-active-light': colorMix(theme.lightValue, 20),
        '--pinned-tab-bg-dark': colorMix(theme.darkValue, 13),
        '--pinned-tab-bg-hover-dark': colorMix(theme.darkValue, 20),
        '--pinned-tab-bg-hover-light': colorMix(theme.lightValue, 16),
        '--pinned-tab-bg-light': colorMix(theme.lightValue, 11),
        '--pinned-tab-color-dark': theme.darkValue,
        '--pinned-tab-color-light': theme.lightValue,
    };
}

export function getPinnedTabColorTheme(color: string): PinnedTabColorTheme {
    const normalized = color.toLowerCase();
    const option = pinnedTabColorOptions.find((entry) => entry.value === normalized);

    return option
        ? { darkValue: option.darkValue, lightValue: option.lightValue }
        : { darkValue: color, lightValue: color };
}

function colorMix(color: string, percent: number) {
    return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}
