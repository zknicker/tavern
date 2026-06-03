import * as React from 'react';
import type { AgentRuntimeConnectionOutput } from '../../lib/trpc.tsx';
import { trpc } from '../../lib/trpc.tsx';
import { useRuntimeConnection } from '../connections/use-runtime-connection.ts';
import { type DesktopUpdateStatus, useDesktopUpdate } from './use-desktop-update.ts';

type RuntimeConnection = NonNullable<AgentRuntimeConnectionOutput>;

export type TavernUpdateStatus =
    | { phase: 'unsupported'; detail: string }
    | { phase: 'idle'; detail: string }
    | { phase: 'app-update-required'; detail: string }
    | { phase: 'runtime-disconnected'; detail: string }
    | { phase: 'available'; detail: string; version: string }
    | { phase: 'checking'; detail: string }
    | { phase: 'staging-runtime'; detail: string; version: string }
    | { phase: 'downloading-app'; detail: string; progress: number; version: string }
    | { phase: 'ready'; detail: string; version: string }
    | { phase: 'restarting-runtime'; detail: string; version: string }
    | { phase: 'restarting-app'; detail: string; version: string }
    | { phase: 'failed'; detail: string };

export function useTavernUpdate() {
    const utils = trpc.useUtils();
    const runtimeConnection = useRuntimeConnection();
    const desktopUpdate = useDesktopUpdate();
    const versionMismatchKind =
        runtimeConnection.status === 'version-mismatch' && runtimeConnection.connection !== null
            ? getRuntimeVersionMismatchKind(runtimeConnection.connection)
            : null;
    const appNeedsUpdate = versionMismatchKind === 'app-needs-update';
    const needsRuntimeUpdate = versionMismatchKind === 'runtime-needs-update';
    const isRuntimeDisconnected =
        runtimeConnection.status === 'error' || runtimeConnection.status === 'unreachable';
    const runtimeUpdateStatus = trpc.agentRuntime.updateStatus.useQuery(undefined, {
        enabled: needsRuntimeUpdate,
        refetchInterval: (query) =>
            query.state.data?.phase === 'installing' || query.state.data?.phase === 'restarting'
                ? 1500
                : false,
        retry: false,
    });
    const startRuntimeUpdate = trpc.agentRuntime.startUpdate.useMutation({
        onSettled: async () => {
            await runtimeUpdateStatus.refetch();
        },
    });
    const restartRuntime = trpc.agentRuntime.restartUpdate.useMutation({
        onSettled: async () => {
            await runtimeUpdateStatus.refetch();
        },
    });
    const [finalRestartPhase, setFinalRestartPhase] = React.useState<'idle' | 'runtime' | 'app'>(
        'idle'
    );

    const status = getTavernUpdateStatus({
        desktopUpdateStatus: desktopUpdate.status,
        appNeedsUpdate,
        finalRestartPhase,
        isRuntimeDisconnected,
        needsRuntimeUpdate,
        runtimeConnection: runtimeConnection.connection,
        runtimeUpdateError: needsRuntimeUpdate
            ? (runtimeUpdateStatus.error?.message ??
              startRuntimeUpdate.error?.message ??
              restartRuntime.error?.message ??
              null)
            : null,
        runtimeUpdateStatus: runtimeUpdateStatus.data ?? null,
    });

    const updateAndRestart = React.useCallback(async () => {
        if (appNeedsUpdate) {
            await desktopUpdate.updateAndRestart();
            return;
        }

        if (needsRuntimeUpdate) {
            if (runtimeUpdateStatus.data?.phase !== 'staged') {
                await startRuntimeUpdate.mutateAsync();
                await waitForRuntimeUpdateStaged({
                    getStatus: () => utils.agentRuntime.updateStatus.fetch(),
                });
            }

            if (desktopUpdate.status.phase === 'available') {
                await desktopUpdate.updateAndRestart();
                return;
            }
        }

        if (desktopUpdate.status.phase !== 'ready') {
            await desktopUpdate.updateAndRestart();
            return;
        }

        if (needsRuntimeUpdate) {
            setFinalRestartPhase('runtime');
            await restartRuntime.mutateAsync();
            await waitForRuntimeVersion({
                getStatus: () => utils.agentRuntime.updateStatus.fetch(),
                requiredVersion: runtimeConnection.connection?.requiredRuntimeVersion ?? null,
            });
        }

        if (desktopUpdate.status.phase === 'ready') {
            setFinalRestartPhase('app');
            await desktopUpdate.updateAndRestart();
            return;
        }

        setFinalRestartPhase('idle');
        await utils.agentRuntime.get.invalidate();
    }, [
        appNeedsUpdate,
        desktopUpdate,
        needsRuntimeUpdate,
        restartRuntime,
        runtimeConnection.connection?.requiredRuntimeVersion,
        runtimeUpdateStatus.data,
        startRuntimeUpdate,
        utils.agentRuntime.get,
        utils.agentRuntime.updateStatus,
    ]);

    return {
        checkForUpdate: desktopUpdate.checkForUpdate,
        status,
        updateAndRestart,
    };
}

export function getTavernUpdateStatus(input: {
    desktopUpdateStatus: DesktopUpdateStatus;
    appNeedsUpdate: boolean;
    finalRestartPhase: 'idle' | 'runtime' | 'app';
    isRuntimeDisconnected: boolean;
    needsRuntimeUpdate: boolean;
    runtimeConnection: AgentRuntimeConnectionOutput;
    runtimeUpdateError: null | string;
    runtimeUpdateStatus: null | {
        currentVersion: string;
        message: null | string;
        phase: 'failed' | 'idle' | 'installing' | 'restarting' | 'staged';
        targetVersion: null | string;
    };
}): TavernUpdateStatus {
    if (input.runtimeUpdateError) {
        return { detail: input.runtimeUpdateError, phase: 'failed' };
    }

    if (input.finalRestartPhase === 'runtime') {
        return {
            detail: 'Restarting Tavern Runtime. Tavern will restart after Runtime is reachable.',
            phase: 'restarting-runtime',
            version: getRuntimeTargetVersion(input.runtimeConnection),
        };
    }

    if (input.finalRestartPhase === 'app') {
        return {
            detail: 'Runtime is ready. Restarting Tavern.',
            phase: 'restarting-app',
            version: getDesktopVersion(input.desktopUpdateStatus),
        };
    }

    const desktopStatus = fromDesktopUpdateStatus(input.desktopUpdateStatus);
    if (input.appNeedsUpdate) {
        if (
            desktopStatus.phase !== 'idle' &&
            desktopStatus.phase !== 'unsupported' &&
            desktopStatus.phase !== 'runtime-disconnected'
        ) {
            return desktopStatus.phase === 'ready'
                ? {
                      ...desktopStatus,
                      detail: 'Tavern update ready. Restart Tavern to reconnect to this Runtime.',
                  }
                : desktopStatus;
        }

        return {
            detail: 'This Tavern app is not compatible with the connected Runtime. Install the latest Tavern update to continue.',
            phase: 'app-update-required',
        };
    }

    if (
        input.isRuntimeDisconnected &&
        desktopStatus.phase !== 'idle' &&
        desktopStatus.phase !== 'unsupported'
    ) {
        return desktopStatus;
    }

    if (input.isRuntimeDisconnected) {
        return {
            detail: 'Tavern Runtime is disconnected.',
            phase: 'runtime-disconnected',
        };
    }

    if (input.needsRuntimeUpdate) {
        if (input.runtimeUpdateStatus?.phase === 'failed') {
            return {
                detail:
                    input.runtimeUpdateStatus.message ??
                    `Runtime ${getRuntimeTargetVersion(input.runtimeConnection)} could not be staged. Click to try again.`,
                phase: 'available',
                version: getRuntimeTargetVersion(input.runtimeConnection),
            };
        }

        if (input.runtimeUpdateStatus?.phase === 'installing') {
            return {
                detail:
                    input.runtimeUpdateStatus.message ??
                    'Installing Runtime update without restarting Runtime.',
                phase: 'staging-runtime',
                version: getRuntimeTargetVersion(input.runtimeConnection),
            };
        }

        if (input.runtimeUpdateStatus?.phase === 'staged') {
            if (
                input.desktopUpdateStatus.phase === 'current' ||
                input.desktopUpdateStatus.phase === 'unsupported'
            ) {
                return {
                    detail: 'Runtime update staged. Restart Runtime to finish.',
                    phase: 'ready',
                    version: getRuntimeTargetVersion(input.runtimeConnection),
                };
            }

            return fromDesktopUpdateStatus(input.desktopUpdateStatus, {
                readyDetail:
                    'Tavern update ready. Restart will restart Runtime first, then Tavern.',
            });
        }

        return {
            detail: `Runtime ${getRuntimeTargetVersion(input.runtimeConnection)} must be staged before Tavern restarts.`,
            phase: 'available',
            version: getRuntimeTargetVersion(input.runtimeConnection),
        };
    }

    return desktopStatus;
}

function fromDesktopUpdateStatus(
    status: DesktopUpdateStatus,
    options?: { readyDetail?: string }
): TavernUpdateStatus {
    switch (status.phase) {
        case 'available':
            return {
                detail: `Tavern ${status.version} is available.`,
                phase: 'available',
                version: status.version,
            };
        case 'checking':
            return { detail: 'Checking for Tavern updates.', phase: 'checking' };
        case 'current':
            return { detail: 'Tavern is up to date.', phase: 'idle' };
        case 'downloading':
            return {
                detail: `Downloading Tavern ${status.version}.`,
                phase: 'downloading-app',
                progress: status.progress,
                version: status.version,
            };
        case 'ready':
            return {
                detail: options?.readyDetail ?? `Tavern ${status.version} is ready to restart.`,
                phase: 'ready',
                version: status.version,
            };
        case 'error':
            return { detail: status.message, phase: 'failed' };
        case 'restarting':
            return {
                detail: 'Restarting Tavern.',
                phase: 'restarting-app',
                version: status.version,
            };
        case 'unsupported':
            return {
                detail: 'Updates are available in the packaged Mac app.',
                phase: 'unsupported',
            };
        default:
            return { detail: 'Tavern update monitor is idle.', phase: 'idle' };
    }
}

function getRuntimeVersionMismatchKind(connection: RuntimeConnection) {
    const comparison = compareVersions(
        connection.runtimeVersion,
        connection.requiredRuntimeVersion
    );
    return comparison > 0 ? 'app-needs-update' : 'runtime-needs-update';
}

function compareVersions(left?: null | string, right?: null | string) {
    if (!(left && right)) {
        return -1;
    }

    const leftParts = toVersionParts(left);
    const rightParts = toVersionParts(right);
    const maxLength = Math.max(leftParts.length, rightParts.length);

    for (let index = 0; index < maxLength; index += 1) {
        const leftPart = leftParts[index] ?? 0;
        const rightPart = rightParts[index] ?? 0;
        if (leftPart !== rightPart) {
            return leftPart > rightPart ? 1 : -1;
        }
    }

    return 0;
}

function toVersionParts(version: string) {
    return version
        .split(/[^\d]+/)
        .filter(Boolean)
        .map((part) => Number(part));
}

function getRuntimeTargetVersion(connection: AgentRuntimeConnectionOutput) {
    return connection?.requiredRuntimeVersion ?? 'latest';
}

function getDesktopVersion(status: DesktopUpdateStatus) {
    return 'version' in status ? status.version : 'latest';
}

async function waitForRuntimeVersion(input: {
    getStatus: () => Promise<{
        currentVersion: string;
    }>;
    requiredVersion: null | string;
}) {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
        try {
            const status = await input.getStatus();
            if (
                !input.requiredVersion ||
                compareVersions(status.currentVersion, input.requiredVersion) >= 0
            ) {
                return;
            }
        } catch {}

        await new Promise((resolve) => setTimeout(resolve, 1200));
    }

    throw new Error('Runtime did not become reachable after restart.');
}

async function waitForRuntimeUpdateStaged(input: {
    getStatus: () => Promise<{
        message: null | string;
        phase: 'failed' | 'idle' | 'installing' | 'restarting' | 'staged';
    }>;
}) {
    const deadline = Date.now() + 10 * 60_000;
    while (Date.now() < deadline) {
        const status = await input.getStatus();
        if (status.phase === 'staged') {
            return;
        }
        if (status.phase === 'failed') {
            throw new Error(status.message ?? 'Runtime update failed.');
        }

        await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    throw new Error('Runtime update did not finish staging in time.');
}
