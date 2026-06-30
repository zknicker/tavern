import { rows } from '../ui.ts';

/**
 * The exact object emitted by `tavern engine status --json`. Key order here is
 * the JSON contract; keep it stable.
 */
export interface EngineStatusReport {
    agentHome: string;
    installedPins: string[];
    mode: 'local-ai-sdk';
    provider: string | null;
    resolved: {
        detail: string;
        tier: 'package';
    };
}

/** Pure human render of the engine status report as aligned key/value rows. */
export function renderEngineStatus(status: EngineStatusReport): string {
    return rows(
        [
            { left: 'Mode', right: status.mode },
            { left: 'Agent home', right: status.agentHome },
            { left: 'Provider', right: status.provider ?? 'not configured' },
            { left: 'Resolved', right: `${status.resolved.detail} (${status.resolved.tier})` },
        ],
        ''
    );
}
