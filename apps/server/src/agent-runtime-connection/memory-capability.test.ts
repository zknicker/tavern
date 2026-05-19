import { beforeEach, expect, test } from 'bun:test';
import type { TavernAgentRuntimeClient } from '../agent-runtime/client.ts';
import { ensureDatabaseSchema } from '../db/bootstrap.ts';
import { databaseClient } from '../db/index.ts';
import { getAgentRuntimeCapabilityStatus } from '../storage/agent-runtime-capability-status.ts';
import { recordOpenClawMemoryCapability } from './memory-capability.ts';

ensureDatabaseSchema();

beforeEach(() => {
    databaseClient.exec('delete from agent_runtime_capability_status');
});

test('records OpenClaw memory healthy when Lossless Claw is loaded and config is ready', async () => {
    await recordOpenClawMemoryCapability({
        client: createMemoryClient({
            config: readyMemoryConfig(),
        }),
        runtimeId: 'runtime-memory-ready',
    });

    await expect(
        getAgentRuntimeCapabilityStatus({
            capability: 'memory',
            runtimeId: 'runtime-memory-ready',
        })
    ).resolves.toMatchObject({
        state: 'healthy',
    });
});

test('records OpenClaw memory unavailable when Lossless Claw is missing', async () => {
    await recordOpenClawMemoryCapability({
        client: createMemoryClient({
            config: {
                plugins: {
                    slots: {
                        contextEngine: 'lossless-claw',
                        memory: 'none',
                    },
                },
            },
        }),
        runtimeId: 'runtime-memory-missing',
    });

    await expect(
        getAgentRuntimeCapabilityStatus({
            capability: 'memory',
            runtimeId: 'runtime-memory-missing',
        })
    ).resolves.toMatchObject({
        errorCode: 'lossless_claw_missing',
        state: 'unavailable',
    });
});

test('records OpenClaw memory unavailable when required config is missing', async () => {
    await recordOpenClawMemoryCapability({
        client: createMemoryClient({
            config: {
                plugins: {
                    entries: {
                        'lossless-claw': {
                            enabled: true,
                        },
                    },
                    slots: {
                        contextEngine: 'lossless-claw',
                        memory: 'active-memory',
                    },
                },
            },
        }),
        runtimeId: 'runtime-memory-config-missing',
    });

    await expect(
        getAgentRuntimeCapabilityStatus({
            capability: 'memory',
            runtimeId: 'runtime-memory-config-missing',
        })
    ).resolves.toMatchObject({
        errorCode: 'openclaw_memory_config_unavailable',
        state: 'unavailable',
    });
});

function createMemoryClient(input: { config: Record<string, unknown> }): TavernAgentRuntimeClient {
    return {
        getOpenClawConfig: async () => ({
            config: input.config,
            hash: 'hash',
            issues: [],
            raw: null,
            valid: true,
        }),
    } as unknown as TavernAgentRuntimeClient;
}

function readyMemoryConfig() {
    return {
        plugins: {
            entries: {
                'lossless-claw': {
                    enabled: true,
                },
            },
            slots: {
                contextEngine: 'lossless-claw',
                memory: 'none',
            },
        },
    };
}
