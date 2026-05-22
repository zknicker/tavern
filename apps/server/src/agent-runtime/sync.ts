import { syncAgentRuntimeSessions } from '../sync/agent-runtime-sync.ts';

let activeSync: Promise<void> | null = null;
let queuedSync = false;

export { syncAgentRuntimeSessions };

export async function requestAgentRuntimeSessionSync() {
    if (activeSync) {
        queuedSync = true;
        return activeSync;
    }

    activeSync = syncAgentRuntimeSessions()
        .then(() => undefined)
        .catch(() => undefined)
        .finally(async () => {
            activeSync = null;

            if (!queuedSync) {
                return;
            }

            queuedSync = false;
            await requestAgentRuntimeSessionSync();
        });

    return activeSync;
}
