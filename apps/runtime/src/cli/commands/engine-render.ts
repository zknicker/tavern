import type { HermesEngineMarker, HermesEnginePin } from '../../hermes/engine.ts';
import type { EngineResolutionStatus } from '../../hermes/engine-resolution.ts';
import { rows } from '../ui.ts';

/**
 * The exact object emitted by `tavern engine status --json`. Key order here is
 * the JSON contract; keep it stable. Also the input to the human renderer.
 */
export interface EngineStatusReport {
    engineRoot: string;
    installedPins: string[];
    marker: HermesEngineMarker | null;
    pin: HermesEnginePin;
    resolved: EngineResolutionStatus;
    systemAllowed: boolean;
}

/** Pure human render of the engine status report as aligned key/value rows. */
export function renderEngineStatus(status: EngineStatusReport): string {
    const entries = [
        {
            left: 'Pin',
            right: `${status.pin.ref} (${status.pin.kind}, from ${status.pin.source})`,
        },
        { left: 'Engine root', right: status.engineRoot },
        { left: 'System installs', right: systemInstallsLine(status.systemAllowed) },
        { left: 'Resolved', right: resolvedLine(status.resolved) },
        { left: 'Managed install', right: markerLine(status.marker) },
    ];
    if (status.installedPins.length > 0) {
        entries.push({ left: 'Installed pins', right: status.installedPins.join(', ') });
    }
    return rows(entries, '');
}

function systemInstallsLine(allowed: boolean): string {
    return allowed
        ? 'allowed (TAVERN_HERMES_ALLOW_SYSTEM)'
        : 'ignored (set TAVERN_HERMES_ALLOW_SYSTEM=1 to use one)';
}

function resolvedLine(resolved: EngineResolutionStatus): string {
    if (resolved.error) {
        return `error — ${resolved.error}`;
    }
    if (resolved.binary) {
        return `${resolved.binary.binaryPath} (${resolved.binary.tier})`;
    }
    return 'none — run "tavern engine install" or start the Runtime.';
}

function markerLine(marker: EngineStatusReport['marker']): string {
    return marker
        ? `${marker.binaryPath} (installed ${marker.installedAt})`
        : 'not installed for the current pin.';
}
