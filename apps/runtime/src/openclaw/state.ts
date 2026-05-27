interface ManagedOpenClawState {
    gatewayReady: boolean;
    tavernPluginPath: string | null;
}

const state: ManagedOpenClawState = {
    tavernPluginPath: null,
    gatewayReady: false,
};

export function getManagedOpenClawState() {
    return state;
}

export function markTavernPluginInstalled(pluginPath: string | null) {
    const changed = state.tavernPluginPath !== pluginPath;
    state.tavernPluginPath = pluginPath;
    return changed;
}

export function markManagedOpenClawGatewayReady() {
    if (state.gatewayReady) {
        return false;
    }

    state.gatewayReady = true;
    return true;
}

export function markManagedOpenClawGatewayStopped() {
    if (!state.gatewayReady) {
        return false;
    }

    state.gatewayReady = false;
    return true;
}
