import { describe, expect, test } from 'bun:test';
import { agentColorPresets, resolveAgentInk } from './agent-color-presets.ts';

describe('resolveAgentInk', () => {
    test('light mode keeps the authored ink (no tint)', () => {
        expect(resolveAgentInk(false, '#2563eb')).toBeUndefined();
        expect(resolveAgentInk(false, null)).toBeUndefined();
    });

    test('dark mode drops the agent color to a low-contrast dark tone', () => {
        const ink = resolveAgentInk(true, '#2563eb');

        expect(ink).toMatch(/^#[0-9a-f]{6}$/u);

        // Dark (all channels low) but still recognizably blue.
        const value = Number.parseInt((ink ?? '').slice(1), 16);
        const r = Math.floor(value / 0x1_00_00);
        const b = value % 0x1_00;

        expect(b).toBeGreaterThan(r);
        expect(Math.max(r, b)).toBeLessThan(120);
    });

    test('missing or invalid colors fall back to the slate preset tone', () => {
        expect(resolveAgentInk(true, null)).toBe(resolveAgentInk(true, agentColorPresets[0].color));
        expect(resolveAgentInk(true, 'not-a-color')).toBe(
            resolveAgentInk(true, agentColorPresets[0].color)
        );
    });

    test('every preset maps to a distinct dark ink', () => {
        const inks = agentColorPresets.map((preset) => resolveAgentInk(true, preset.color));

        expect(new Set(inks).size).toBe(agentColorPresets.length);
    });
});
