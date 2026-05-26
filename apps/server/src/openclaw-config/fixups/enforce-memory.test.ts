import { describe, expect, test } from 'bun:test';
import { enforceOpenClawMemoryConfig, isOpenClawMemoryConfigReady } from './enforce-memory.ts';

describe('enforceOpenClawMemoryConfig', () => {
    test('removes incompatible OpenClaw memory plugins', () => {
        const config = enforceOpenClawMemoryConfig({
            plugins: {
                allow: ['active-memory', 'memory-core', 'lossless-claw', 'other-plugin'],
                entries: {
                    'active-memory': {
                        enabled: true,
                    },
                    'memory-core': {
                        enabled: true,
                    },
                    'lossless-claw': {
                        enabled: true,
                    },
                    'other-plugin': {
                        enabled: true,
                    },
                },
                installs: {
                    'active-memory': {
                        source: 'npm',
                        spec: '@openclaw/active-memory@2026.5.12',
                    },
                    'memory-core': {
                        source: 'npm',
                        spec: '@openclaw/memory-core@2026.5.12',
                    },
                },
                slots: {
                    contextEngine: 'lossless-claw',
                    other: 'keep',
                },
            },
        });

        expect(config.plugins as unknown).toEqual({
            allow: ['other-plugin'],
            entries: {
                'other-plugin': {
                    enabled: true,
                },
            },
            slots: {
                memory: 'none',
                other: 'keep',
            },
        });
        expect(isOpenClawMemoryConfigReady(config)).toBe(true);
    });

    test('reports incomplete memory config as not ready', () => {
        expect(
            isOpenClawMemoryConfigReady({
                plugins: {
                    entries: {
                        'active-memory': {
                            enabled: true,
                        },
                        'memory-core': {
                            enabled: true,
                        },
                    },
                    allow: ['active-memory', 'memory-core'],
                    slots: {
                        memory: 'none',
                    },
                },
            })
        ).toBe(false);
    });

    test('reports removed context engine as not ready', () => {
        expect(
            isOpenClawMemoryConfigReady({
                plugins: {
                    entries: {
                        'lossless-claw': {
                            enabled: true,
                        },
                    },
                    allow: ['lossless-claw', 'other-plugin'],
                    slots: {
                        contextEngine: 'lossless-claw',
                        memory: 'none',
                    },
                },
            })
        ).toBe(false);
    });
});
