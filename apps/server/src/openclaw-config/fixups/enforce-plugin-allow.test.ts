import { expect, test } from 'bun:test';
import { enforcePluginAllowlist } from './enforce-plugin-allow.ts';

test('enforcePluginAllowlist pins Tavern plugin trust and preserves configured plugins', () => {
    const config: Record<string, unknown> = {
        plugins: {
            entries: {
                tavern: { enabled: true },
                codex: { enabled: true },
            },
        },
    };

    expect(enforcePluginAllowlist(config) as Record<string, unknown>).toEqual({
        plugins: {
            allow: ['codex', 'tavern'],
            entries: {
                tavern: { enabled: true },
                codex: { enabled: true },
            },
        },
    });
});

test('enforcePluginAllowlist preserves existing trusted plugin ids and configured entries', () => {
    const config: Record<string, unknown> = {
        plugins: {
            allow: ['browser', 'codex'],
            entries: {
                clawbuddy: { enabled: true },
                openai: { enabled: true },
            },
        },
    };

    expect(enforcePluginAllowlist(config) as Record<string, unknown>).toEqual({
        plugins: {
            allow: ['browser', 'clawbuddy', 'codex', 'openai', 'tavern'],
            entries: {
                clawbuddy: { enabled: true },
                openai: { enabled: true },
            },
        },
    });
});
