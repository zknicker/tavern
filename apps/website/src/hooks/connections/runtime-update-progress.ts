export const runtimeUpdateTimeoutMs = 10 * 60 * 1000;

const runtimeUpdateStorageKey = 'tavern.runtimeUpdate';

export interface RuntimeUpdateProgress {
    baseUrl: string;
    requiredVersion: string;
    runtimeVersion: null | string;
    startedAt: string;
}

function storageAvailable() {
    return typeof window !== 'undefined' && Boolean(window.localStorage);
}

export function readRuntimeUpdateProgress(): RuntimeUpdateProgress | null {
    if (!storageAvailable()) {
        return null;
    }

    const raw = window.localStorage.getItem(runtimeUpdateStorageKey);
    if (!raw) {
        return null;
    }

    try {
        const parsed = JSON.parse(raw) as Partial<RuntimeUpdateProgress>;
        if (!(parsed.baseUrl && parsed.requiredVersion && parsed.startedAt)) {
            return null;
        }
        return {
            baseUrl: parsed.baseUrl,
            requiredVersion: parsed.requiredVersion,
            runtimeVersion: parsed.runtimeVersion ?? null,
            startedAt: parsed.startedAt,
        };
    } catch {
        return null;
    }
}

export function writeRuntimeUpdateProgress(progress: RuntimeUpdateProgress) {
    if (storageAvailable()) {
        window.localStorage.setItem(runtimeUpdateStorageKey, JSON.stringify(progress));
    }
}

export function clearRuntimeUpdateProgress() {
    if (storageAvailable()) {
        window.localStorage.removeItem(runtimeUpdateStorageKey);
    }
}

export function isRuntimeUpdateProgressActive(input: {
    connection: null | { appVersion: string; baseUrl: string };
    now?: number;
}) {
    const progress = readRuntimeUpdateProgress();
    if (!(progress && input.connection)) {
        return false;
    }

    const startedAt = Date.parse(progress.startedAt);
    if (!Number.isFinite(startedAt)) {
        return false;
    }

    return (
        progress.baseUrl === input.connection.baseUrl &&
        progress.requiredVersion === input.connection.appVersion &&
        (input.now ?? Date.now()) - startedAt < runtimeUpdateTimeoutMs
    );
}
