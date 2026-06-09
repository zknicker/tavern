export type ManagedHermesBootstrapPhase = 'failed' | 'idle' | 'installing';

interface ManagedHermesBootstrapState {
    message: null | string;
    phase: ManagedHermesBootstrapPhase;
    startedAt: null | string;
}

interface ManagedHermesState {
    apiReady: boolean;
    bootstrap: ManagedHermesBootstrapState;
    homePath: string | null;
}

const state: ManagedHermesState = {
    apiReady: false,
    bootstrap: { message: null, phase: 'idle', startedAt: null },
    homePath: null,
};

export function getManagedHermesState() {
    return state;
}

export function markManagedHermesHome(homePath: string | null) {
    const changed = state.homePath !== homePath;
    state.homePath = homePath;
    return changed;
}

export function markManagedHermesApiReady() {
    if (state.apiReady) {
        return false;
    }

    state.apiReady = true;
    return true;
}

export function markManagedHermesApiStopped() {
    if (!state.apiReady) {
        return false;
    }

    state.apiReady = false;
    return true;
}

export function markManagedHermesBootstrap(
    phase: ManagedHermesBootstrapPhase,
    message?: null | string
) {
    const changed =
        state.bootstrap.phase !== phase || state.bootstrap.message !== (message ?? null);
    state.bootstrap = {
        message: message ?? null,
        phase,
        startedAt: phase === 'installing' ? new Date().toISOString() : state.bootstrap.startedAt,
    };
    return changed;
}
