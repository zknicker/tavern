import { type ResolvedHermesBinary, resolveInstalledHermesBinary } from './bootstrap';

/**
 * Resolved engine binary plus the resolution error, if any. Shared by the
 * `tavern engine status` view and `tavern status` so both report the same
 * tier/path without duplicating the try/catch around binary resolution.
 */
export interface EngineResolutionStatus {
    binary: ResolvedHermesBinary | null;
    error: null | string;
}

/** Resolve the installed engine binary, capturing any resolution error. */
export function resolveEngineStatus(): EngineResolutionStatus {
    try {
        return { binary: resolveInstalledHermesBinary(), error: null };
    } catch (err) {
        return { binary: null, error: err instanceof Error ? err.message : String(err) };
    }
}

/** Resolved engine binary, or null when none resolves (errors swallowed). */
export function resolveEngineResolution(): ResolvedHermesBinary | null {
    return resolveEngineStatus().binary;
}
