import fs from 'node:fs/promises';
import path from 'node:path';
import type {
    AgentRuntimeAgent,
    AgentRuntimeCron,
    AgentRuntimeCronRun,
    AgentRuntimeHermesModelName,
} from '@tavern/api';
import { HERMES_HOME } from '../config';

interface HermesAdapterState {
    agent?: {
        enabledSkillIds?: string[];
        hermesModelName?: AgentRuntimeHermesModelName | null;
        name?: string;
        thinkingDefault?: AgentRuntimeAgent['thinkingDefault'];
    };
    cronJobs?: AgentRuntimeCron[];
    cronRuns?: AgentRuntimeCronRun[];
}

const statePath = path.join(HERMES_HOME, 'tavern-adapter-state.json');

export async function readHermesAdapterState(): Promise<HermesAdapterState> {
    try {
        const parsed = JSON.parse(await fs.readFile(statePath, 'utf8')) as HermesAdapterState;
        return {
            agent: parsed.agent && typeof parsed.agent === 'object' ? parsed.agent : undefined,
            cronJobs: Array.isArray(parsed.cronJobs) ? parsed.cronJobs : [],
            cronRuns: Array.isArray(parsed.cronRuns) ? parsed.cronRuns : [],
        };
    } catch {
        return { cronJobs: [], cronRuns: [] };
    }
}

export async function writeHermesAdapterState(state: HermesAdapterState) {
    await fs.mkdir(path.dirname(statePath), { recursive: true });
    await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    try {
        await fs.chmod(statePath, 0o600);
    } catch {
        // chmod is best-effort on non-POSIX filesystems.
    }
}

export async function updateHermesAdapterState(
    update: (state: HermesAdapterState) => HermesAdapterState
) {
    const current = await readHermesAdapterState();
    const next = update(current);
    await writeHermesAdapterState(next);
    return next;
}
