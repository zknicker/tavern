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
    state.tavernPluginPath = pluginPath;
}

export function markManagedOpenClawGatewayReady() {
    state.gatewayReady = true;
}

export function markManagedOpenClawGatewayStopped() {
    state.gatewayReady = false;
}
