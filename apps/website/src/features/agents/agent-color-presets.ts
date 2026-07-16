export const agentColorPresets = [
    { color: '#64748b', label: 'Slate' },
    { color: '#f97316', label: 'Orange' },
    { color: '#f59e0b', label: 'Gold' },
    { color: '#ef4444', label: 'Red' },
    { color: '#ec4899', label: 'Pink' },
    { color: '#a855f7', label: 'Purple' },
    { color: '#6366f1', label: 'Indigo' },
    { color: '#2563eb', label: 'Blue' },
    { color: '#0ea5e9', label: 'Sky' },
    { color: '#14b8a6', label: 'Teal' },
    { color: '#22c55e', label: 'Green' },
] as const;

// Each character's dominant shell color, sampled from the authored head art.
// Seat tiles behind transcript avatars derive from these — the art carries
// the identity color, not the agent's configured accent (which defaults to
// the same slate for everyone).
export const characterSeatColors: Record<string, string> = {
    alien: '#6d941f',
    bird: '#0265e3',
    knight: '#4e3e84',
    none: '#64748b',
    owl: '#573aa5',
    robot: '#04abc5',
};

export function resolveCharacterSeatColor(character: string) {
    return characterSeatColors[character] ?? characterSeatColors.none ?? '#64748b';
}

// AgentFace ink for the current theme. Light mode keeps the art's authored
// ink (undefined → AgentFace default). Dark mode drops the agent's configured
// color to a low-contrast dark-surface tone: hue kept, saturation capped,
// lightness pinned low (e.g. Blue #2563eb → a muted navy near #194154).
export function resolveAgentInk(
    dark: boolean,
    primaryColor: string | null | undefined
): string | undefined {
    if (!dark) {
        return;
    }

    const hsl = hexToHsl(primaryColor ?? '') ?? hexToHsl(agentColorPresets[0].color);

    if (!hsl) {
        return;
    }

    return hslToHex(hsl.h, Math.min(hsl.s, 0.55), 0.22);
}

function hexToHsl(hex: string): { h: number; l: number; s: number } | null {
    const match = /^#([0-9a-f]{6})$/iu.exec(hex.trim());

    if (!match) {
        return null;
    }

    const value = Number.parseInt(match[1], 16);
    const r = Math.floor(value / 0x1_00_00) / 255;
    const g = (Math.floor(value / 0x1_00) % 0x1_00) / 255;
    const b = (value % 0x1_00) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const l = (max + min) / 2;

    if (delta === 0) {
        return { h: 0, l, s: 0 };
    }

    const s = delta / (1 - Math.abs(2 * l - 1));
    let h: number;

    if (max === r) {
        h = 60 * (((g - b) / delta) % 6);
    } else if (max === g) {
        h = 60 * ((b - r) / delta + 2);
    } else {
        h = 60 * ((r - g) / delta + 4);
    }

    return { h: (h + 360) % 360, l, s };
}

function hslToHex(h: number, s: number, l: number): string {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    const sector = Math.floor(h / 60) % 6;
    const rgb = [
        [c, x, 0],
        [x, c, 0],
        [0, c, x],
        [0, x, c],
        [x, 0, c],
        [c, 0, x],
    ][sector];

    return `#${rgb
        .map((channel) =>
            Math.round((channel + m) * 255)
                .toString(16)
                .padStart(2, '0')
        )
        .join('')}`;
}
