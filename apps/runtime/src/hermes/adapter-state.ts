import fs from 'node:fs/promises';
import path from 'node:path';
import type {
    AgentRuntimeAgent,
    AgentRuntimeCron,
    AgentRuntimeCronRun,
    AgentRuntimeHermesModelName,
} from '@tavern/api';
import { HERMES_HOME } from '../config';

export interface HermesConfiguredAgentState {
    avatar?: null | string;
    emoji?: null | string;
    enabledSkillIds?: string[];
    hermesModelName?: AgentRuntimeHermesModelName | null;
    name?: string;
    thinkingDefault?: AgentRuntimeAgent['thinkingDefault'];
}

export interface HermesAdapterState {
    /** Legacy pre-agentConfigured state; read for migration only. */
    agent?: HermesConfiguredAgentState;
    /**
     * User/API-saved agent settings. Absence means Tavern/runtime defaults.
     * Runtime startup must not write defaults here.
     */
    agentConfigured?: HermesConfiguredAgentState;
    cronJobs?: AgentRuntimeCron[];
    cronRuns?: AgentRuntimeCronRun[];
}

const statePath = path.join(HERMES_HOME, 'tavern-adapter-state.json');

export async function readHermesAdapterState(): Promise<HermesAdapterState> {
    try {
        const parsed = JSON.parse(await fs.readFile(statePath, 'utf8')) as HermesAdapterState;
        return {
            agent: parseConfiguredAgentState(parsed.agent),
            agentConfigured: parseConfiguredAgentState(parsed.agentConfigured),
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

export function resolveHermesConfiguredAgentState(state: HermesAdapterState): {
    legacy: boolean;
    settings: HermesConfiguredAgentState;
} | null {
    if (state.agentConfigured) {
        return { legacy: false, settings: state.agentConfigured };
    }
    if (state.agent) {
        return { legacy: true, settings: state.agent };
    }
    return null;
}

export async function updateHermesConfiguredAgentState(
    update: (settings: HermesConfiguredAgentState) => HermesConfiguredAgentState
) {
    const current = await readHermesAdapterState();
    const existing = resolveHermesConfiguredAgentState(current)?.settings ?? {};
    const next = update(existing);
    return await writeHermesAdapterState({
        ...current,
        agent: undefined,
        agentConfigured: next,
    });
}

function parseConfiguredAgentState(value: unknown): HermesConfiguredAgentState | undefined {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as HermesConfiguredAgentState)
        : undefined;
}
