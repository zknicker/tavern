interface OrphanExitWatchOptions {
    clearInterval?: typeof globalThis.clearInterval;
    enabled: boolean;
    exit: (code?: number) => void;
    getParentPid: () => number;
    intervalMs?: number;
    logger?: Pick<Console, 'log'>;
    setInterval?: typeof globalThis.setInterval;
}

const defaultOrphanCheckIntervalMs = 250;

export function isOrphanedProcess(parentPid: number) {
    return parentPid === 1;
}

export function startOrphanExitWatch({
    clearInterval = globalThis.clearInterval,
    enabled,
    exit,
    getParentPid,
    intervalMs = defaultOrphanCheckIntervalMs,
    logger = console,
    setInterval = globalThis.setInterval,
}: OrphanExitWatchOptions) {
    if (!enabled || isOrphanedProcess(getParentPid())) {
        return () => undefined;
    }

    const timer = setInterval(() => {
        if (!isOrphanedProcess(getParentPid())) {
            return;
        }

        clearInterval(timer);
        logger.log('[tavern] server exiting because the dev parent process disappeared');
        exit(0);
    }, intervalMs);

    timer.unref?.();

    return () => {
        clearInterval(timer);
    };
}
