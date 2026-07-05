interface CronQueuePayload {
    jobId: string;
    runId?: string;
    scheduledFor?: string;
    trigger: 'manual' | 'recovery' | 'schedule';
}

export interface RuntimeCronManager {
    enqueue(input: CronQueuePayload): Promise<string>;
    isHealthy(): boolean;
    reconcile(options?: { recoverMissed?: boolean }): Promise<void>;
    stop(): Promise<void>;
}

let activeManager: RuntimeCronManager | null = null;

export function getRuntimeCronManager(): RuntimeCronManager | null {
    return activeManager;
}

export function setRuntimeCronManager(manager: RuntimeCronManager): void {
    activeManager = manager;
}

export function clearRuntimeCronManager(manager: RuntimeCronManager): void {
    if (activeManager === manager) {
        activeManager = null;
    }
}

export function isRuntimeCronReady(): boolean {
    return activeManager?.isHealthy() ?? false;
}

export async function reconcileActiveCronSchedules(): Promise<void> {
    await activeManager?.reconcile();
}

export async function enqueueCronRun(input: CronQueuePayload): Promise<string | null> {
    return (await activeManager?.enqueue(input)) ?? null;
}
