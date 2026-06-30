import runtimePackage from '../../../package.json';
import { readConfigValue } from '../../config';
import { type Brew, brew } from '../brew';
import type { ParsedArgs } from '../parse';
import { localRuntimeUrl, probeRuntimeSnapshot, type RuntimeSnapshot } from '../runtime-probe';
import { writeJson } from '../ui';
import { renderStatus, type StatusEngineSection, type StatusReport } from './status-render';

/** Injectable I/O for `tavern status`, so tests supply fixtures for every edge. */
export interface StatusDeps {
    binaryVersion: string;
    brew: Brew;
    engineSection(): StatusEngineSection;
    localUrl: string;
    now(): number;
    probe(url: string): Promise<RuntimeSnapshot>;
    write(text: string): void;
}

function defaultDeps(): StatusDeps {
    return {
        brew,
        binaryVersion: runtimePackage.version,
        engineSection: readEngineSection,
        localUrl: localRuntimeUrl(),
        now: () => Date.now(),
        probe: probeRuntimeSnapshot,
        write: (text) => process.stdout.write(text),
    };
}

/**
 * `tavern status [--json] [--runtime-url <url>]`. Gathers brew service state, a
 * runtime/capability snapshot, and local engine resolution into one report.
 * Every source is tolerant: a failed brew/runtime/engine probe nulls its section
 * rather than throwing, so partial failures still render a useful screen. Exit 0
 * even when components are unhealthy — status reports, it does not judge.
 */
export async function runStatusCommand(
    args: ParsedArgs,
    overrides?: Partial<StatusDeps>
): Promise<number> {
    const deps = { ...defaultDeps(), ...overrides };
    const url = args.values['--runtime-url'] ?? process.env.TAVERN_RUNTIME_URL ?? deps.localUrl;

    const snapshot = await deps.probe(url);
    const report: StatusReport = {
        binary: { version: deps.binaryVersion },
        service: readServiceSection(deps.brew),
        runtime: {
            url,
            reachable: snapshot.reachable,
            version: snapshot.version,
            health: snapshot.health,
        },
        runtimeIsLocal: url === deps.localUrl,
        capabilities: snapshot.capabilities,
        engine: deps.engineSection(),
    };

    if (args.flags['--json']) {
        writeJson(report, deps.write);
        return 0;
    }

    deps.write(`${renderStatus(report, { now: deps.now(), stream: process.stdout })}\n`);
    return 0;
}

/** Read the Homebrew service state; null when brew is unavailable. */
function readServiceSection(driver: Brew): StatusReport['service'] {
    const result = driver.servicesInfoRuntimeJson();
    if (result.missing) {
        return null;
    }
    return { state: parseServiceState(result.stdout), via: 'homebrew' };
}

function parseServiceState(stdout: string): string {
    try {
        const parsed = JSON.parse(stdout) as
            | { running?: boolean; status?: string }[]
            | { running?: boolean; status?: string };
        const entry = Array.isArray(parsed) ? parsed[0] : parsed;
        if (!entry) {
            return 'none';
        }
        if (entry.running) {
            return 'running';
        }
        return entry.status === 'none' || !entry.status ? 'stopped' : entry.status;
    } catch {
        return 'unknown';
    }
}

/** Local engine resolution for the agent/AI SDK engine. */
function readEngineSection(): StatusEngineSection {
    return {
        mode: 'local-ai-sdk',
        provider: readConfigValue('TAVERN_AGENT_PROVIDER'),
        resolved: { detail: 'Agent and AI SDK package dependencies', tier: 'package' },
    };
}
