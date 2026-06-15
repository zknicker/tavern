import { createLocalHermesClient } from './local-client';

type SharedHermesClient = ReturnType<typeof createLocalHermesClient>;

let sharedHermesClient: SharedHermesClient | null = null;

export function getSharedHermesClient() {
    if (sharedHermesClient) {
        return sharedHermesClient;
    }

    sharedHermesClient = createLocalHermesClient();
    return sharedHermesClient;
}

export function closeSharedHermesClient() {
    sharedHermesClient?.close();
    sharedHermesClient = null;
}
