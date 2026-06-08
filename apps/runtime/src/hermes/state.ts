interface ManagedHermesState {
    apiReady: boolean;
    homePath: string | null;
}

const state: ManagedHermesState = {
    apiReady: false,
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
