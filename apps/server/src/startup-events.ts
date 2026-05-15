const startupEventPrefix = 'TAVERN_STARTUP_EVENT ';

function isStartupUiEnabled() {
    return process.env.TAVERN_STARTUP_UI === '1';
}

export function emitStartupEvent(type: string, payload: Record<string, unknown> = {}) {
    if (!isStartupUiEnabled()) {
        return;
    }

    console.log(
        `${startupEventPrefix}${JSON.stringify({
            payload,
            source: 'server',
            timestamp: new Date().toISOString(),
            type,
        })}`
    );
}

export function emitStartupJobEvent(input: {
    cadence: string;
    immediate: boolean;
    key: string;
    label: string;
    state: 'disabled' | 'enabled';
}) {
    emitStartupEvent('jobs.item', input);
}

export function emitStartupJobsLoading() {
    emitStartupEvent('jobs.loading');
}

export function emitStartupJobsReady(count: number) {
    emitStartupEvent('jobs.ready', { count });
}
