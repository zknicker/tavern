import type { AgentRuntimeOpenClawConfigSnapshot } from '@tavern/agent-runtime-protocol';
import { TRPCError } from '@trpc/server';
import type { TavernAgentRuntimeClient } from '../agent-runtime/client.ts';
import { createAgentRuntimeClientForConnection } from '../agent-runtime/client-factory.ts';
import { syncRuntimeAgents } from '../agents/sync.ts';
import {
    emitAgentInvalidationCascade,
    emitModelUpdated,
    emitOpenClawConfigUpdated,
} from '../api/invalidation-events.ts';
import {
    getActiveAgentRuntimeConnection,
    getAgentRuntimeConnection,
    listReachableAgentRuntimeConnections,
    markAgentRuntimeConnectionSync,
} from '../storage/agent-runtime-connections.ts';
import {
    getOpenClawConfigSnapshot,
    markOpenClawConfigSnapshotError,
    type OpenClawConfigSnapshotRecord,
    saveOpenClawConfigSnapshot,
} from '../storage/openclaw-config-snapshots.ts';
import {
    applyOpenClawConfigInputSchema,
    openClawConfigSnapshotSchema,
    openClawConfigStateSchema,
} from './contracts.ts';
import { runOpenClawConfigFixups } from './fixups/runner.ts';

type SyncLog = (message: string) => Promise<void>;
type RuntimeConnection = NonNullable<Awaited<ReturnType<typeof getActiveAgentRuntimeConnection>>>;

export function shouldApplyOpenClawConfigFixups(input: { valid: boolean | null }) {
    return input.valid !== false;
}

export async function getOpenClawConfigState() {
    const runtime = await getActiveAgentRuntimeConnection();

    if (!runtime) {
        return openClawConfigStateSchema.parse({
            runtimeId: null,
            snapshot: null,
        });
    }

    return openClawConfigStateSchema.parse({
        runtimeId: runtime.id,
        snapshot: mapSnapshotRecord(await getOpenClawConfigSnapshot(runtime.id)),
    });
}

export async function applyOpenClawConfig(input: unknown) {
    const parsed = applyOpenClawConfigInputSchema.parse(input);
    const runtime = await getAgentRuntimeConnection(parsed.runtimeId);

    if (!(runtime?.enabled && runtime.lastCheckedAt && !runtime.lastError)) {
        throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Start Tavern Runtime before saving settings.',
        });
    }

    const localSnapshot = await getOpenClawConfigSnapshot(runtime.id);
    if (localSnapshot?.valid === 'false') {
        throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'OpenClaw config is invalid. Fix the runtime config before saving settings.',
        });
    }

    if (localSnapshot && localSnapshot.hash !== parsed.baseHash) {
        throw new TRPCError({
            code: 'CONFLICT',
            message:
                'Runtime config changed since this draft was created. Discard and reload before saving.',
        });
    }

    const client = createAgentRuntimeClientForConnection(runtime);

    try {
        const fixupResult = await runOpenClawConfigFixups({
            config: omitTavernAgentPresentationKeys(parsed.config),
            context: {
                runtimeId: runtime.id,
            },
        });
        const snapshot = await applyOpenClawConfigWithReconnect({
            baseHash: parsed.baseHash,
            client,
            config: fixupResult.config,
            runtime,
        });
        await saveOpenClawConfigSnapshot({
            runtimeId: runtime.id,
            snapshot,
        });
        await syncRuntimeAgents();
        emitOpenClawConfigUpdated();
        emitModelUpdated();
        emitAgentInvalidationCascade();
    } finally {
        client.close();
    }

    return await getOpenClawConfigState();
}

export async function applyCurrentOpenClawConfigFixups() {
    const runtime = await getActiveAgentRuntimeConnection();

    if (!(runtime?.enabled && runtime.lastCheckedAt && !runtime.lastError)) {
        return;
    }

    const client = createAgentRuntimeClientForConnection(runtime);

    try {
        const remoteSnapshot = await client.getOpenClawConfig();
        await saveOpenClawConfigSnapshot({
            runtimeId: runtime.id,
            snapshot: remoteSnapshot,
        });

        if (!shouldApplyOpenClawConfigFixups(remoteSnapshot)) {
            return;
        }

        const result = await runOpenClawConfigFixups({
            config: omitTavernAgentPresentationKeys(remoteSnapshot.config),
            context: {
                runtimeId: runtime.id,
            },
        });
        if (!result.changed) {
            return;
        }

        const snapshot = await applyOpenClawConfigWithReconnect({
            baseHash: remoteSnapshot.hash,
            client,
            config: result.config,
            runtime,
        });
        await saveOpenClawConfigSnapshot({
            runtimeId: runtime.id,
            snapshot,
        });
        await syncRuntimeAgents();
        emitOpenClawConfigUpdated();
        emitModelUpdated();
        emitAgentInvalidationCascade();
    } finally {
        client.close();
    }
}

export async function syncOpenClawConfigSnapshots(input?: { log?: SyncLog }) {
    const runtimes = await listReachableAgentRuntimeConnections();
    const results: Array<{ runtimeId: string; runtimeName: string; synced: number }> = [];
    let appliedAnyFixup = false;

    if (runtimes.length === 0) {
        await input?.log?.('No reachable Tavern Runtime connection is available.');
        return results;
    }

    for (const runtime of runtimes) {
        const client = createAgentRuntimeClientForConnection(runtime);
        const attemptedAt = new Date().toISOString();

        try {
            const remoteSnapshot = await client.getOpenClawConfig();
            if (!shouldApplyOpenClawConfigFixups(remoteSnapshot)) {
                await saveOpenClawConfigSnapshot({
                    runtimeId: runtime.id,
                    snapshot: remoteSnapshot,
                    syncedAt: attemptedAt,
                });
                await markAgentRuntimeConnectionSync({
                    id: runtime.id,
                    lastError: null,
                    lastSyncedAt: attemptedAt,
                });
                results.push({
                    runtimeId: runtime.id,
                    runtimeName: runtime.name,
                    synced: 1,
                });
                await input?.log?.(
                    `Synced invalid runtime config from ${runtime.name}; skipped Tavern fixups.`
                );
                continue;
            }

            const fixupResult = await runOpenClawConfigFixups({
                config: remoteSnapshot.config,
                context: {
                    runtimeId: runtime.id,
                },
            });
            const snapshot = fixupResult.changed
                ? await applyOpenClawConfigWithReconnect({
                      baseHash: remoteSnapshot.hash,
                      client,
                      config: fixupResult.config,
                      runtime,
                  })
                : remoteSnapshot;

            await saveOpenClawConfigSnapshot({
                runtimeId: runtime.id,
                snapshot,
                syncedAt: attemptedAt,
            });
            if (fixupResult.changed) {
                appliedAnyFixup = true;
                await syncRuntimeAgents();
            }
            await markAgentRuntimeConnectionSync({
                id: runtime.id,
                lastError: null,
                lastSyncedAt: attemptedAt,
            });
            results.push({
                runtimeId: runtime.id,
                runtimeName: runtime.name,
                synced: 1,
            });
            await input?.log?.(
                fixupResult.changed
                    ? `Synced runtime config from ${runtime.name} and applied ${fixupResult.applied.length} fixup(s).`
                    : `Synced runtime config from ${runtime.name}.`
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await markOpenClawConfigSnapshotError({
                error: message,
                runtimeId: runtime.id,
            });
            await markAgentRuntimeConnectionSync({
                id: runtime.id,
                lastError: message,
                lastSyncedAt: runtime.lastSyncedAt,
            });
            await input?.log?.(`Failed to sync runtime config from ${runtime.name}: ${message}`);
            throw error;
        } finally {
            client.close();
        }
    }

    emitOpenClawConfigUpdated();
    if (appliedAnyFixup) {
        emitModelUpdated();
        emitAgentInvalidationCascade();
    }
    return results;
}

async function applyOpenClawConfigWithReconnect(input: {
    baseHash: string;
    client: TavernAgentRuntimeClient;
    config: Record<string, unknown>;
    runtime: RuntimeConnection;
}): Promise<AgentRuntimeOpenClawConfigSnapshot> {
    try {
        return await input.client.applyOpenClawConfig({
            baseHash: input.baseHash,
            config: input.config,
        });
    } catch (error) {
        if (!isRuntimeReconnectAfterConfigApply(error)) {
            throw error;
        }

        input.client.close();
        return await readOpenClawConfigAfterReconnect(input.runtime, error);
    }
}

async function readOpenClawConfigAfterReconnect(
    runtime: RuntimeConnection,
    originalError: unknown
): Promise<AgentRuntimeOpenClawConfigSnapshot> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
        if (attempt > 0) {
            await sleep(500);
        }

        const client = createAgentRuntimeClientForConnection(runtime);
        try {
            return await client.getOpenClawConfig();
        } catch {
            // OpenClaw may still be reloading its Gateway after config.apply.
        } finally {
            client.close();
        }
    }

    throw originalError;
}

function isRuntimeReconnectAfterConfigApply(error: unknown) {
    if (!(error instanceof Error)) {
        return false;
    }

    const message = error.message.toLowerCase();
    const errorCode = (error as { code?: unknown }).code;
    const code = typeof errorCode === 'string' ? errorCode.toLowerCase() : '';

    return (
        code.includes('closed') ||
        code.includes('connect') ||
        message.includes('connection closed') ||
        message.includes('gateway connection closed') ||
        message.includes('failed to fetch')
    );
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function omitTavernAgentPresentationKeys(config: Record<string, unknown>) {
    const agents = readRecord(config.agents);
    const list = Array.isArray(agents.list) ? agents.list.map(readRecord) : null;

    if (!list) {
        return config;
    }

    return {
        ...config,
        agents: {
            ...agents,
            list: list.map((agent) => {
                const { color: _color, primaryColor: _primaryColor, ...agentConfig } = agent;
                return agentConfig;
            }),
        },
    };
}

function readRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function mapSnapshotRecord(record: OpenClawConfigSnapshotRecord | null) {
    if (!record) {
        return null;
    }

    const config = JSON.parse(record.configJson) as Record<string, unknown>;

    return openClawConfigSnapshotSchema.parse({
        config,
        hash: record.hash,
        issues: JSON.parse(record.issuesJson) as unknown,
        lastError: record.lastError,
        lastSyncedAt: record.lastSyncedAt,
        raw: JSON.stringify(config, null, 2),
        runtimeId: record.runtimeId,
        valid: record.valid === 'unknown' ? null : record.valid === 'true',
    });
}
