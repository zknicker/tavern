import type { RuntimeCapability } from '../runtime-probe';
import { heading, rows, type StatusTone, statusDot, ui } from '../ui';

/** Service section: brew service state. Null when brew is unavailable. */
export interface StatusServiceSection {
    /** 'running' | 'stopped' | 'none'. */
    state: string;
    via: 'homebrew';
}

/** Runtime section: liveness + running version from the probed runtime URL. */
export interface StatusRuntimeSection {
    health: string | null;
    reachable: boolean;
    url: string;
    version: string | null;
}

/** Engine section: pin and resolved binary, from local engine resolution. */
export interface StatusEngineSection {
    pin: { kind: string; ref: string; source: string };
    resolved: { path: string; tier: string } | null;
}

/**
 * Full status report. This is the exact shape emitted by `--json` (unavailable
 * sections are nulled out, never omitted) and the input to the text renderer.
 */
export interface StatusReport {
    binary: { version: string };
    capabilities: RuntimeCapability[] | null;
    engine: StatusEngineSection;
    runtime: StatusRuntimeSection;
    /**
     * True when the probed runtime URL is the local default. Staged/cutover hints
     * comparing against the local binary only make sense for the local runtime.
     */
    runtimeIsLocal: boolean;
    /** Null when brew is unavailable. */
    service: StatusServiceSection | null;
}

export interface RenderOptions {
    /** Now, in ms, for relative-time formatting. Injected so tests are stable. */
    now: number;
    stream: NodeJS.WriteStream;
}

/** Render the full human status screen. */
export function renderStatus(report: StatusReport, options: RenderOptions): string {
    const blocks = [
        renderHeaderRows(report, options.stream),
        renderCapabilities(report.capabilities, options),
        renderEngine(report.engine, options.stream),
    ];
    return blocks.join('\n\n');
}

function renderHeaderRows(report: StatusReport, stream: NodeJS.WriteStream): string {
    const header = ui.bold(`Tavern Runtime v${report.binary.version}`, stream);
    // Service and Binary always describe this box; label them when the probed
    // Runtime is remote so the local rows next to a remote Runtime don't read
    // as the same host.
    const localTag = report.runtimeIsLocal ? '' : ' (local)';
    const body = rows(
        [
            { left: `Service${localTag}`, right: serviceLine(report.service) },
            { left: 'Runtime', right: runtimeLine(report) },
            { left: `Binary${localTag}`, right: binaryLine(report) },
        ],
        '  '
    );
    return `${header}\n\n${body}`;
}

function serviceLine(service: StatusServiceSection | null): string {
    if (!service) {
        return 'unknown — Homebrew not available';
    }
    return `${service.state} (${service.via})`;
}

function runtimeLine(report: StatusReport): string {
    const { runtime } = report;
    if (!runtime.reachable) {
        return "not running · 'brew services start tavern-runtime'";
    }
    const version = runtime.version ? `v${runtime.version}` : 'running';
    const health = runtime.health ?? 'unknown';
    const base = `${version} · ${health} · ${runtime.url}`;
    if (
        report.runtimeIsLocal &&
        runtime.version &&
        runtime.version !== report.binary.version &&
        isOlder(runtime.version, report.binary.version)
    ) {
        return `${version} · ${health} — binary v${report.binary.version} staged, run 'tavern restart'`;
    }
    return base;
}

function binaryLine(report: StatusReport): string {
    const binary = report.binary.version;
    const running = report.runtime.version;
    if (!(report.runtimeIsLocal && report.runtime.reachable && running)) {
        return `v${binary} · installed`;
    }
    if (running === binary) {
        return `v${binary} · up to date`;
    }
    if (isOlder(running, binary)) {
        return `v${binary} · staged — runtime still on v${running}`;
    }
    return `v${binary} · runtime ahead on v${running}`;
}

function renderCapabilities(
    capabilities: RuntimeCapability[] | null,
    options: RenderOptions
): string {
    const title = heading('Capabilities', options.stream);
    if (capabilities === null) {
        return `${title}\n  ${ui.dim('Runtime not reachable — capabilities unavailable.', options.stream)}`;
    }
    if (capabilities.length === 0) {
        return `${title}\n  ${ui.dim('No capabilities reported.', options.stream)}`;
    }
    const width = capabilities.reduce((max, cap) => Math.max(max, cap.displayName.length), 0);
    const stateWidth = capabilities.reduce((max, cap) => Math.max(max, cap.state.length), 0);
    const lines = capabilities.map((cap) => {
        const dot = statusDot(capabilityTone(cap.state), options.stream);
        const name = cap.displayName.padEnd(width);
        const state = cap.state.padEnd(stateWidth);
        const when = relativeTime(cap.updatedAt, options.now);
        const reason = cap.reason ? ` — ${cap.reason}` : '';
        return `  ${dot} ${name}  ${state}  ${when}${reason}`;
    });
    return `${title}\n${lines.join('\n')}`;
}

function renderEngine(engine: StatusEngineSection, stream: NodeJS.WriteStream): string {
    const title = heading('Engine', stream);
    const resolved = engine.resolved
        ? `${engine.resolved.path} (${engine.resolved.tier})`
        : "none — run 'tavern engine install'";
    const body = rows(
        [
            {
                left: 'Pin',
                right: `${shortRef(engine.pin.ref)} (${engine.pin.kind}, ${engine.pin.source})`,
            },
            { left: 'Resolved', right: resolved },
        ],
        '  '
    );
    return `${title}\n${body}`;
}

/** Capability state → status dot tone. */
export function capabilityTone(state: string): StatusTone {
    if (state === 'healthy') {
        return 'healthy';
    }
    if (state === 'degraded' || state === 'unknown') {
        return 'degraded';
    }
    return 'off';
}

/**
 * Compact relative time from an ISO timestamp to `now` (ms). Returns 'unknown'
 * for a null/unparseable input. Pure: the caller injects `now`.
 */
export function relativeTime(iso: string | null, now: number): string {
    if (!iso) {
        return 'unknown';
    }
    const then = Date.parse(iso);
    if (Number.isNaN(then)) {
        return 'unknown';
    }
    const deltaMs = now - then;
    if (deltaMs < 45_000) {
        return 'just now';
    }
    const minutes = Math.round(deltaMs / 60_000);
    if (minutes < 60) {
        return `${minutes}m ago`;
    }
    const hours = Math.round(deltaMs / 3_600_000);
    if (hours < 24) {
        return `${hours}h ago`;
    }
    const days = Math.round(deltaMs / 86_400_000);
    return `${days}d ago`;
}

function shortRef(ref: string): string {
    return ref.length > 12 && /^[0-9a-f]+$/i.test(ref) ? ref.slice(0, 7) : ref;
}

/** True when semantic-ish version `a` sorts before `b`. Falls back to string. */
function isOlder(a: string, b: string): boolean {
    const pa = a.split('.').map((part) => Number.parseInt(part, 10));
    const pb = b.split('.').map((part) => Number.parseInt(part, 10));
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const ai = pa[i] ?? 0;
        const bi = pb[i] ?? 0;
        if (Number.isNaN(ai) || Number.isNaN(bi)) {
            return a < b;
        }
        if (ai !== bi) {
            return ai < bi;
        }
    }
    return false;
}
