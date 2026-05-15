import type { IconSvgElement } from '@hugeicons/react';
import {
    BrowserIcon,
    CubeIcon,
    MagicWand01Icon,
    PlugIcon,
    TerminalIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import type { ToolMentionKind } from './tool-mention-types.ts';

export interface ToolMentionAppearance {
    icon: IconSvgElement;
    tone: 'app' | 'skill' | 'tool';
}

const appearanceById: Record<string, ToolMentionAppearance> = {
    browser: { icon: BrowserIcon, tone: 'app' },
    'browser-use': { icon: BrowserIcon, tone: 'app' },
    chrome: { icon: BrowserIcon, tone: 'app' },
    github: { icon: PlugIcon, tone: 'app' },
};

const appearanceByToolName: Record<string, ToolMentionAppearance> = {
    bash: { icon: TerminalIcon, tone: 'tool' },
    browser: { icon: BrowserIcon, tone: 'tool' },
    webfetch: { icon: BrowserIcon, tone: 'tool' },
    websearch: { icon: BrowserIcon, tone: 'tool' },
};

export function getToolMentionAppearance(input: {
    id: string;
    kind: ToolMentionKind;
    label: string;
}): ToolMentionAppearance {
    const idKey = input.id.trim().toLowerCase();
    const labelKey = input.label.trim().toLowerCase();

    if (appearanceById[idKey]) {
        return appearanceById[idKey];
    }

    if (input.kind === 'tool' && appearanceByToolName[labelKey]) {
        return appearanceByToolName[labelKey];
    }

    if (input.kind === 'skill') {
        return { icon: CubeIcon, tone: 'skill' };
    }

    if (input.kind === 'app') {
        return { icon: PlugIcon, tone: 'app' };
    }

    return { icon: MagicWand01Icon, tone: 'tool' };
}
