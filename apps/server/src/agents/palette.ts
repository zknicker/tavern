import type { Agent } from './catalog.ts';

const initialsSplitPattern = /[\s:_-]+/;

function shortName(value: string) {
    return value
        .split(initialsSplitPattern)
        .filter(Boolean)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('')
        .slice(0, 2);
}

export function resolveAgentName(agent: Agent) {
    return agent.name;
}

function hashHue(value: string) {
    let hash = 0;

    for (const char of value) {
        hash = (hash * 31 + char.charCodeAt(0)) % Number.MAX_SAFE_INTEGER;
    }

    return ['#f97316', '#f59e0b', '#2563eb', '#0ea5e9', '#ec4899'][hash % 5] ?? '#f97316';
}

function toRgb(hex: string) {
    return {
        blue: Number.parseInt(hex.slice(5, 7), 16),
        green: Number.parseInt(hex.slice(3, 5), 16),
        red: Number.parseInt(hex.slice(1, 3), 16),
    };
}

function fromRgb(red: number, green: number, blue: number) {
    return `#${[red, green, blue]
        .map((value) =>
            Math.max(0, Math.min(255, Math.round(value)))
                .toString(16)
                .padStart(2, '0')
        )
        .join('')}`;
}

function darkenHex(hex: string, ratio: number) {
    const rgb = toRgb(hex);
    const scale = 1 - ratio;
    return fromRgb(rgb.red * scale, rgb.green * scale, rgb.blue * scale);
}

export function resolveAgentDefaultPrimaryColor(agentId: string) {
    return hashHue(agentId);
}

export function buildAgentPalette(agent: Agent) {
    const primaryColor = agent.primaryColor ?? resolveAgentDefaultPrimaryColor(agent.id);

    return {
        accentFrom: primaryColor,
        accentTo: darkenHex(primaryColor, 0.58),
    };
}

export function resolveAgentAvatar(agent: Agent) {
    return agent.emoji ?? agent.avatar ?? shortName(resolveAgentName(agent) || agent.id);
}
