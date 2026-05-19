import { describe, expect, test } from 'bun:test';
import { enforceOpenClawMemoryConfig, isOpenClawMemoryConfigReady } from './enforce-memory.ts';

describe('enforceOpenClawMemoryConfig', () => {
    test('writes required Lossless Claw plugin config', () => {
        const config = enforceOpenClawMemoryConfig({
            plugins: {
                allow: ['active-memory', 'memory-core', 'other-plugin'],
                entries: {
                    'active-memory': {
                        enabled: true,
                    },
                    'memory-core': {
                        enabled: true,
                    },
                    'other-plugin': {
                        enabled: true,
                    },
                    'lossless-claw': {
                        extra: 'keep',
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
                    other: 'keep',
                },
            },
        });

        expect(config.plugins as unknown).toEqual({
            allow: ['lossless-claw', 'other-plugin'],
            entries: {
                'other-plugin': {
                    enabled: true,
                },
                'lossless-claw': {
                    enabled: true,
                    extra: 'keep',
                },
            },
            installs: {},
            slots: {
                contextEngine: 'lossless-claw',
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
                        'lossless-claw': {
                            enabled: true,
                        },
                        'active-memory': {
                            enabled: true,
                        },
                        'memory-core': {
                            enabled: true,
                        },
                    },
                    allow: ['active-memory', 'memory-core', 'lossless-claw'],
                    slots: {
                        contextEngine: 'lossless-claw',
                        memory: 'none',
                    },
                },
            })
        ).toBe(false);
    });

    test('reports disallowed Lossless Claw as not ready', () => {
        expect(
            isOpenClawMemoryConfigReady({
                plugins: {
                    entries: {
                        'lossless-claw': {
                            enabled: true,
                        },
                    },
                    allow: ['other-plugin'],
                    slots: {
                        contextEngine: 'lossless-claw',
                        memory: 'none',
                    },
                },
            })
        ).toBe(false);
    });
});
