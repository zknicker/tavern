import type { IconSvgElement } from '@hugeicons/react';
import {
    ChromeIcon,
    CommandLineIcon,
    CubeIcon,
    File01Icon,
    Folder01Icon,
    Github01Icon,
    Image01Icon,
    MagicWand01Icon,
    PlugIcon,
} from '@hugeicons-pro/core-solid-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import { cn } from '../../lib/utils.ts';
import type { MentionOptionKind } from './mention-types.ts';

const mentionIconKeys = [
    'chrome',
    'command',
    'file',
    'folder',
    'github',
    'image',
    'plugin',
    'skill',
    'unknown',
] as const;

const mentionToneKeys = ['brand', 'mention', 'path'] as const;

export type MentionIconKey = (typeof mentionIconKeys)[number];
export type MentionTone = (typeof mentionToneKeys)[number];

export interface MentionAppearance {
    brandColor?: string;
    icon: MentionIconKey;
    iconDataUrl?: string;
    label?: string;
    tone: MentionTone;
}

interface MentionAppearanceInput {
    id: string;
    kind: MentionOptionKind;
    label: string;
    metadata?: Record<string, unknown>;
}

type MentionAppearanceOverride = Partial<MentionAppearance>;

const defaultMentionAppearance = {
    app: { icon: 'plugin', tone: 'mention' },
    command: { icon: 'command', tone: 'mention' },
    directory: { icon: 'folder', tone: 'path' },
    file: { icon: 'file', tone: 'path' },
    image: { icon: 'image', tone: 'path' },
    plugin: { icon: 'plugin', tone: 'mention' },
    skill: { icon: 'skill', tone: 'mention' },
} satisfies Record<MentionOptionKind, MentionAppearance>;

const skillAppearanceOverrides = {
    'gh-issues': {
        brandColor: 'var(--foreground)',
        icon: 'github',
        label: 'GitHub Issues',
        tone: 'brand',
    },
    github: { brandColor: 'var(--foreground)', icon: 'github', label: 'GitHub', tone: 'brand' },
} satisfies Record<string, MentionAppearanceOverride>;

const capabilityAppearanceOverrides = {
    'computer-use@openai-bundled': {
        icon: 'plugin',
        label: 'Computer Use',
        tone: 'mention',
    },
    'computer-use/google-chrome': {
        brandColor: 'var(--success-foreground)',
        icon: 'chrome',
        label: 'Chrome',
        tone: 'brand',
    },
    'chrome@openai-bundled': {
        brandColor: 'var(--success-foreground)',
        icon: 'chrome',
        label: 'Chrome',
        tone: 'brand',
    },
    chrome: {
        brandColor: 'var(--success-foreground)',
        icon: 'chrome',
        label: 'Chrome',
        tone: 'brand',
    },
} satisfies Record<string, MentionAppearanceOverride>;

const mentionIconMap = {
    chrome: ChromeIcon,
    command: CommandLineIcon,
    file: File01Icon,
    folder: Folder01Icon,
    github: Github01Icon,
    image: Image01Icon,
    plugin: PlugIcon,
    skill: CubeIcon,
    unknown: MagicWand01Icon,
} satisfies Record<MentionIconKey, IconSvgElement>;

export function getMentionAppearance(input: MentionAppearanceInput): MentionAppearance {
    const base = defaultMentionAppearance[input.kind];
    const override = getMentionAppearanceOverride(input);

    return {
        ...base,
        ...override,
    };
}

export function MentionAppearanceIcon({
    className,
    iconDataUrl,
    icon,
}: {
    className?: string;
    iconDataUrl?: string;
    icon: MentionIconKey;
}) {
    if (iconDataUrl) {
        return (
            <img
                alt=""
                className={className}
                draggable={false}
                height={16}
                src={iconDataUrl}
                width={16}
            />
        );
    }

    return <Icon className={className} icon={mentionIconMap[icon]} />;
}

export function getMentionDisplayLabel(input: MentionAppearanceInput) {
    return getMentionAppearance(input).label ?? input.label;
}

export function getMentionTextToneClassName(tone: MentionTone) {
    return cn(
        tone === 'brand' && 'text-[color:var(--mention-brand-color)]',
        tone === 'mention' &&
            'text-[color:color-mix(in_srgb,var(--info-foreground)_80%,var(--foreground)_20%)]',
        tone === 'path' &&
            'text-[color:color-mix(in_srgb,var(--info-foreground)_80%,var(--foreground)_20%)]'
    );
}

export function getMentionIconToneClassName(tone: MentionTone) {
    return cn(
        tone === 'brand' && 'text-[color:var(--mention-brand-color)]',
        tone === 'mention' &&
            'text-[color:color-mix(in_srgb,var(--info-foreground)_80%,var(--foreground)_20%)]',
        tone === 'path' &&
            'text-[color:color-mix(in_srgb,var(--info-foreground)_80%,var(--foreground)_20%)]'
    );
}

function getMentionAppearanceOverride(input: MentionAppearanceInput) {
    const metadataIconDataUrl = readString(input.metadata?.iconDataUrl);

    if (input.kind === 'app' && metadataIconDataUrl) {
        return {
            iconDataUrl: metadataIconDataUrl,
        } satisfies MentionAppearanceOverride;
    }

    if (input.kind === 'skill') {
        return getKeyedOverride(skillAppearanceOverrides, input);
    }

    if (input.kind === 'app' || input.kind === 'plugin') {
        return getKeyedOverride(capabilityAppearanceOverrides, input);
    }

    return undefined;
}

function getKeyedOverride(
    overrides: Record<string, MentionAppearanceOverride>,
    input: MentionAppearanceInput
) {
    for (const key of getMentionLookupKeys(input)) {
        const override = overrides[key];

        if (override) {
            return override;
        }
    }

    return undefined;
}

function getMentionLookupKeys(input: MentionAppearanceInput) {
    if (input.kind === 'app') {
        return [normalizeLookupKey(input.label)].filter(isPresent);
    }

    return [
        normalizeLookupKey(input.id),
        normalizeLookupKey(input.label),
        normalizeLookupKey(getSkillDirectoryName(input.id)),
        normalizeLookupKey(getMentionUriName(input.id)),
    ].filter(isPresent);
}

function getSkillDirectoryName(id: string) {
    const match = id.match(/\/skills\/([^/]+)\/SKILL\.md$/u);
    return match?.[1] ?? null;
}

function getMentionUriName(id: string) {
    const match = id.match(/^(?:app|plugin):\/\/(.+)$/u);
    return match?.[1] ?? null;
}

function normalizeLookupKey(value: string | null) {
    return value?.trim().replace(/^@/u, '').replace(/^\$/u, '').toLowerCase() || null;
}

function isPresent<T>(value: T | null | undefined): value is T {
    return value != null;
}

function readString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}
