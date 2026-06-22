import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readConfigValue } from '../config';

/**
 * Known-good Hermes commit for the managed engine install. Upgrades bump this
 * pin and refresh the bundled installer snapshot; see
 * docs/operations/hermes-runtime-upgrade.md.
 */
export const hermesPinnedCommit = '5937b95192bc02a98a8a29d44caffd71f2b25694';

export const hermesInstallerUrl = 'https://hermes-agent.nousresearch.com/install.sh';

export interface HermesEnginePin {
    kind: 'commit' | 'branch';
    ref: string;
    source: 'commit-env' | 'branch-env' | 'pinned';
}

export interface HermesEngineAppliedPatch {
    checksum: string;
    id: string;
}

export interface HermesEngineMarker {
    binaryPath: string;
    installedAt: string;
    installerSource: 'bundled-asset' | 'remote-download';
    patches: HermesEngineAppliedPatch[];
    ref: string;
}

export function resolveHermesPin(): HermesEnginePin {
    const commit = readConfigValue('TAVERN_HERMES_COMMIT');
    if (commit) {
        return { kind: 'commit', ref: commit, source: 'commit-env' };
    }
    const branch = readConfigValue('TAVERN_HERMES_BRANCH');
    if (branch) {
        return { kind: 'branch', ref: branch, source: 'branch-env' };
    }
    return { kind: 'commit', ref: hermesPinnedCommit, source: 'pinned' };
}

/**
 * The engine root is shared machine-wide (anchored at HOME, never under the
 * per-worktree TAVERN_RUNTIME_ROOT) so every worktree and the Homebrew service
 * reuse one install per pin.
 */
export function engineRoot(): string {
    return path.join(process.env.HOME || os.homedir(), '.tavern', 'engine');
}

export function engineInstallDir(pin: HermesEnginePin): string {
    return path.join(engineRoot(), enginePinDirName(pin), 'hermes-agent');
}

export function engineBinaryPath(pin: HermesEnginePin): string {
    return path.join(engineInstallDir(pin), 'venv', 'bin', 'hermes');
}

export function engineMarkerPath(pin: HermesEnginePin): string {
    return path.join(engineRoot(), enginePinDirName(pin), 'install.json');
}

export function listEnginePinDirs(): string[] {
    try {
        return fs
            .readdirSync(engineRoot(), { withFileTypes: true })
            .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
            .map((entry) => entry.name);
    } catch {
        return [];
    }
}

export function readEngineMarker(pin: HermesEnginePin): HermesEngineMarker | null {
    try {
        const raw = fs.readFileSync(engineMarkerPath(pin), 'utf8');
        const parsed = JSON.parse(raw) as Partial<HermesEngineMarker>;
        if (!(parsed.binaryPath && parsed.installedAt && parsed.ref)) {
            return null;
        }
        return {
            binaryPath: parsed.binaryPath,
            installedAt: parsed.installedAt,
            installerSource: parsed.installerSource ?? 'bundled-asset',
            patches: readAppliedPatches(parsed.patches),
            ref: parsed.ref,
        };
    } catch {
        return null;
    }
}

export function writeEngineMarker(pin: HermesEnginePin, marker: HermesEngineMarker): void {
    const markerPath = engineMarkerPath(pin);
    fs.mkdirSync(path.dirname(markerPath), { recursive: true });
    fs.writeFileSync(markerPath, `${JSON.stringify(marker, null, 4)}\n`);
}

export function enginePinDirName(pin: HermesEnginePin): string {
    // Branch refs can contain path separators; keep dir names flat.
    return pin.ref.replaceAll('/', '-');
}

function readAppliedPatches(value: unknown): HermesEngineAppliedPatch[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .filter(
            (item): item is Partial<HermesEngineAppliedPatch> =>
                typeof item === 'object' && item !== null
        )
        .flatMap((item) =>
            typeof item.id === 'string' && typeof item.checksum === 'string'
                ? [{ id: item.id, checksum: item.checksum }]
                : []
        );
}
