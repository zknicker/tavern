import type { Agent } from './catalog.ts';

export function resolveAgentName(agent: Agent) {
    return agent.name;
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

export function resolveAgentDefaultPrimaryColor(_agentId: string) {
    return '#64748b';
}

export function buildAgentPalette(agent: Agent) {
    const primaryColor = agent.primaryColor ?? resolveAgentDefaultPrimaryColor(agent.id);

    return {
        accentFrom: primaryColor,
        accentTo: darkenHex(primaryColor, 0.58),
    };
}
