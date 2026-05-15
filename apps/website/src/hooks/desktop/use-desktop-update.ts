import { isTauri } from '@tauri-apps/api/core';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, type DownloadEvent, type Update } from '@tauri-apps/plugin-updater';
import { useCallback, useEffect, useRef, useState } from 'react';

export type DesktopUpdateStatus =
    | { phase: 'unsupported' }
    | { phase: 'idle' }
    | { phase: 'checking' }
    | { phase: 'current' }
    | { phase: 'available'; version: string }
    | { phase: 'downloading'; progress: number; version: string }
    | { phase: 'restarting'; version: string }
    | { phase: 'error'; message: string };

export function useDesktopUpdate() {
    const updateRef = useRef<Update | null>(null);
    const [status, setStatus] = useState<DesktopUpdateStatus>(() =>
        isTauri() ? { phase: 'idle' } : { phase: 'unsupported' }
    );

    const checkForUpdate = useCallback(async () => {
        if (!isTauri()) {
            setStatus({ phase: 'unsupported' });
            return;
        }

        updateRef.current = null;
        setStatus({ phase: 'checking' });

        try {
            const update = await check();
            updateRef.current = update;
            setStatus(
                update ? { phase: 'available', version: update.version } : { phase: 'current' }
            );
        } catch (error) {
            setStatus({
                phase: 'error',
                message: getErrorMessage(error, 'Tavern could not check for updates.'),
            });
        }
    }, []);

    const updateAndRestart = useCallback(async () => {
        const update = updateRef.current;

        if (!update) {
            await checkForUpdate();
            return;
        }

        let totalBytes = 0;
        let downloadedBytes = 0;

        try {
            setStatus({ phase: 'downloading', progress: 0, version: update.version });
            await update.download((event) => {
                const nextProgress = readDownloadProgress({
                    downloadedBytes,
                    event,
                    totalBytes,
                });

                downloadedBytes = nextProgress.downloadedBytes;
                totalBytes = nextProgress.totalBytes;

                setStatus({
                    phase: 'downloading',
                    progress: nextProgress.progress,
                    version: update.version,
                });
            });
            await update.install();
            setStatus({ phase: 'restarting', version: update.version });
            await relaunch();
        } catch (error) {
            setStatus({
                phase: 'error',
                message: getErrorMessage(error, 'Tavern could not install the update.'),
            });
        }
    }, [checkForUpdate]);

    useEffect(() => {
        if (!isTauri()) {
            return;
        }

        void checkForUpdate();
    }, [checkForUpdate]);

    return {
        checkForUpdate,
        status,
        updateAndRestart,
    };
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
