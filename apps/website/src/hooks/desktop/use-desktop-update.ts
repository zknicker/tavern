import { isTauri } from '@tauri-apps/api/core';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, type DownloadEvent, type Update } from '@tauri-apps/plugin-updater';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

const updateCheckIntervalMs = 10 * 60 * 1000;

export type DesktopUpdateStatus =
    | { phase: 'unsupported' }
    | { phase: 'idle' }
    | { phase: 'checking' }
    | { phase: 'current' }
    | { phase: 'available'; version: string }
    | { phase: 'downloading'; progress: number; version: string }
    | { phase: 'ready'; version: string }
    | { phase: 'restarting'; version: string }
    | { phase: 'error'; message: string };

let currentStatus: DesktopUpdateStatus = isTauri() ? { phase: 'idle' } : { phase: 'unsupported' };
let currentUpdate: Update | null = null;
let monitorStarted = false;
let monitorIntervalId: number | null = null;
let activeTask: Promise<void> | null = null;

const listeners = new Set<() => void>();

export function useDesktopUpdate() {
    const status = useSyncExternalStore(subscribeDesktopUpdate, getDesktopUpdateSnapshot);

    useEffect(() => {
        startDesktopUpdateMonitor();
    }, []);

    const checkForUpdate = useCallback(async () => {
        await checkForDesktopUpdate({ install: false });
    }, []);

    const updateAndRestart = useCallback(async () => {
        await installDesktopUpdateAndRestart();
    }, []);

    return {
        checkForUpdate,
        status,
        updateAndRestart,
    };
}

function startDesktopUpdateMonitor() {
    if (monitorStarted || !isTauri()) {
        return;
    }

    monitorStarted = true;
    void checkForDesktopUpdate({ install: true });
    monitorIntervalId = window.setInterval(() => {
        void checkForDesktopUpdate({ install: true });
    }, updateCheckIntervalMs);
}

function subscribeDesktopUpdate(listener: () => void) {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);

        if (listeners.size === 0 && monitorIntervalId !== null) {
            window.clearInterval(monitorIntervalId);
            monitorIntervalId = null;
            monitorStarted = false;
        }
    };
}

function getDesktopUpdateSnapshot() {
    return currentStatus;
}

function setDesktopUpdateStatus(status: DesktopUpdateStatus) {
    currentStatus = status;

    for (const listener of listeners) {
        listener();
    }
}

async function checkForDesktopUpdate({ install }: { install: boolean }) {
    if (!isTauri()) {
        setDesktopUpdateStatus({ phase: 'unsupported' });
        return;
    }

    if (isPersistentUpdateStatus(currentStatus)) {
        return;
    }

    if (activeTask) {
        await activeTask;
        return;
    }

    activeTask = checkForDesktopUpdateTask({ install }).finally(() => {
        activeTask = null;
    });

    await activeTask;
}

async function checkForDesktopUpdateTask({ install }: { install: boolean }) {
    currentUpdate = null;

    if (!isPersistentUpdateStatus(currentStatus)) {
        setDesktopUpdateStatus({ phase: 'checking' });
    }

    try {
        const update = await check();
        currentUpdate = update;

        if (!update) {
            setDesktopUpdateStatus({ phase: 'current' });
            return;
        }

        setDesktopUpdateStatus({ phase: 'available', version: update.version });

        if (install) {
            await downloadAndInstallUpdate(update);
        }
    } catch (error) {
        setDesktopUpdateStatus({
            phase: 'error',
            message: getErrorMessage(error, 'Tavern could not check for updates.'),
        });
    }
}

async function installDesktopUpdateAndRestart() {
    if (currentStatus.phase === 'ready') {
        setDesktopUpdateStatus({ phase: 'restarting', version: currentStatus.version });
        await relaunch();
        return;
    }

    const update = currentUpdate;

    if (!update) {
        await checkForDesktopUpdate({ install: true });
        return;
    }

    await downloadAndInstallUpdate(update);
    await installDesktopUpdateAndRestart();
}

async function downloadAndInstallUpdate(update: Update) {
    let totalBytes = 0;
    let downloadedBytes = 0;

    try {
        setDesktopUpdateStatus({ phase: 'downloading', progress: 0, version: update.version });
        await update.download((event) => {
            const nextProgress = readDownloadProgress({
                downloadedBytes,
                event,
                totalBytes,
            });

            downloadedBytes = nextProgress.downloadedBytes;
            totalBytes = nextProgress.totalBytes;

            setDesktopUpdateStatus({
                phase: 'downloading',
                progress: nextProgress.progress,
                version: update.version,
            });
        });
        await update.install();
        setDesktopUpdateStatus({ phase: 'ready', version: update.version });
    } catch (error) {
        setDesktopUpdateStatus({
            phase: 'error',
            message: getErrorMessage(error, 'Tavern could not install the update.'),
        });
    }
}

function isPersistentUpdateStatus(status: DesktopUpdateStatus) {
    return (
        status.phase === 'downloading' || status.phase === 'ready' || status.phase === 'restarting'
    );
}

function readDownloadProgress({
    downloadedBytes,
    event,
    totalBytes,
}: {
    downloadedBytes: number;
    event: DownloadEvent;
    totalBytes: number;
}) {
    if (event.event === 'Started') {
        const nextTotalBytes = event.data.contentLength ?? 0;
        return {
            downloadedBytes: 0,
            progress: 0,
            totalBytes: nextTotalBytes,
        };
    }

    if (event.event === 'Progress') {
        const nextDownloadedBytes = downloadedBytes + event.data.chunkLength;
        return {
            downloadedBytes: nextDownloadedBytes,
            progress: totalBytes > 0 ? Math.min(nextDownloadedBytes / totalBytes, 1) : 0,
            totalBytes,
        };
    }

    return {
        downloadedBytes: totalBytes,
        progress: 1,
        totalBytes,
    };
}

function getErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    if (typeof error === 'string' && error) {
        return error;
    }

    return fallback;
}
