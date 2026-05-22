import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';

export interface ComputerUseAppInventoryEntry {
    bundleId?: string;
    iconDataUrl?: string;
    label: string;
    lastUsedAt?: string;
    running?: boolean;
    usageCount?: number;
}

export interface ComputerUseAppInventory {
    entries: ComputerUseAppInventoryEntry[];
    source: 'local';
    status: 'ready' | 'unavailable';
}

const computerUsePluginUri = 'plugin://computer-use@openai-bundled';
const inventoryTtlMs = 30_000;
const inventoryFetchTimeoutMs = 2500;

let cachedInventory:
    | {
          expiresAt: number;
          inventory: ComputerUseAppInventory;
      }
    | null = null;

export function getComputerUsePluginUri() {
    return computerUsePluginUri;
}

export function clearComputerUseAppInventoryCache() {
    cachedInventory = null;
}

export async function listComputerUseApps({
    fetchInventory = fetchRuntimeComputerUseAppInventory,
    now = Date.now(),
    query = '',
}: {
    fetchInventory?: (query: string) => Promise<ComputerUseAppInventory | null>;
    now?: number;
    query?: string;
} = {}): Promise<ComputerUseAppInventory> {
    if (!query && cachedInventory && cachedInventory.expiresAt > now) {
        return cachedInventory.inventory;
    }

    const inventory =
        (await safeFetchInventory({ fetchInventory, query })) ?? unavailableInventory();

    if (!query && inventory.status === 'ready') {
        cachedInventory = {
            expiresAt: now + inventoryTtlMs,
            inventory,
        };
        return inventory;
    }

    if (!query) {
        cachedInventory = {
            expiresAt: now + inventoryTtlMs,
            inventory,
        };
    }

    return inventory;
}

async function safeFetchInventory({
    fetchInventory,
    query,
}: {
    fetchInventory: (query: string) => Promise<ComputerUseAppInventory | null>;
    query: string;
}) {
    try {
        return await withTimeout(fetchInventory(query), inventoryFetchTimeoutMs, null);
    } catch {
        return null;
    }
}

function unavailableInventory(): ComputerUseAppInventory {
    return { entries: [], source: 'local', status: 'unavailable' };
}

async function fetchRuntimeComputerUseAppInventory(
    query: string
): Promise<ComputerUseAppInventory | null> {
    const client = createConfiguredAgentRuntimeClient();

    if (!client) {
        return null;
    }

    const { apps } = await client.listMacApps({ limit: query ? 12 : 80, query });

    return apps.length > 0 ? { entries: apps, source: 'local', status: 'ready' } : null;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutValue: T) {
    return new Promise<T>((resolve, reject) => {
        const timeout = setTimeout(() => {
            resolve(timeoutValue);
        }, timeoutMs);

        promise
            .then(resolve, reject)
            .finally(() => {
                clearTimeout(timeout);
            });
    });
}
