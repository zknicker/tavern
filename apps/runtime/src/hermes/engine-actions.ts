import type { AgentRuntimeSkillHubActionResult } from '@tavern/api';
import type { HermesHttp } from './http';
import { asRecord, readStringArray } from './mappers';

export interface EngineActionOptions {
    pollIntervalMs?: number;
    timeoutMs?: number;
}

const defaultPollIntervalMs = 1000;
const defaultTimeoutMs = 180_000;

/**
 * Engine background actions (skill installs, toolset post-setup) return a pid
 * immediately and stream their log to `/api/actions/<name>/status`. Poll that
 * status until the process exits so callers see one synchronous result.
 */
export async function awaitEngineAction(
    http: HermesHttp,
    name: string,
    options?: EngineActionOptions
): Promise<AgentRuntimeSkillHubActionResult> {
    const pollIntervalMs = options?.pollIntervalMs ?? defaultPollIntervalMs;
    const deadline = Date.now() + (options?.timeoutMs ?? defaultTimeoutMs);

    while (Date.now() < deadline) {
        await sleep(pollIntervalMs);
        const status = asRecord(await http.get(`/api/actions/${encodeURIComponent(name)}/status`));
        if (status.running === true) {
            continue;
        }
        const exitCode = typeof status.exit_code === 'number' ? status.exit_code : null;
        return {
            exitCode,
            log: readStringArray(status.lines),
            ok: exitCode === 0,
        };
    }

    throw new Error(`Engine action "${name}" timed out.`);
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
