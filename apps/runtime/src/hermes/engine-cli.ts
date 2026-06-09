import fs from 'node:fs/promises';
import path from 'node:path';
import {
    ensureHermesBinary,
    type ResolvedHermesBinary,
    resolveInstalledHermesBinary,
} from './bootstrap';
import {
    enginePinDirName,
    engineRoot,
    listEnginePinDirs,
    readEngineMarker,
    resolveHermesPin,
} from './engine';

export async function runEngineCli(args: string[]): Promise<void> {
    const [command, ...rest] = args;

    switch (command) {
        case 'clean':
            await cleanEngineInstalls(rest.includes('--all'));
            return;
        case 'install':
            await installEngine();
            return;
        case 'status':
            showEngineStatus(rest.includes('--json'));
            return;
        default:
            throw new Error(
                command ? `Unknown engine command: ${command}` : 'Missing engine command.'
            );
    }
}

function showEngineStatus(json: boolean): void {
    const pin = resolveHermesPin();
    const status = {
        engineRoot: engineRoot(),
        installedPins: listEnginePinDirs(),
        marker: readEngineMarker(pin),
        pin,
        resolved: resolveBinaryStatus(),
    };

    if (json) {
        console.log(JSON.stringify(status, null, 2));
        return;
    }

    console.log(`Pin: ${pin.ref} (${pin.kind}, from ${pin.source})`);
    console.log(`Engine root: ${status.engineRoot}`);
    if (status.resolved.error) {
        console.log(`Resolved: error — ${status.resolved.error}`);
    } else if (status.resolved.binary) {
        console.log(
            `Resolved: ${status.resolved.binary.binaryPath} (${status.resolved.binary.tier})`
        );
    } else {
        console.log('Resolved: none — run "tavern engine install" or start the Runtime.');
    }
    console.log(
        status.marker
            ? `Managed install: ${status.marker.binaryPath} (installed ${status.marker.installedAt})`
            : 'Managed install: not installed for the current pin.'
    );
    if (status.installedPins.length > 0) {
        console.log(`Installed pins: ${status.installedPins.join(', ')}`);
    }
}

async function installEngine(): Promise<void> {
    const resolved = await ensureHermesBinary({
        forceInstall: true,
        onInstallerLine: (line) => console.log(line),
    });
    console.log(`Agent engine ready: ${resolved.binaryPath} (${resolved.tier})`);
}

async function cleanEngineInstalls(all: boolean): Promise<void> {
    const pin = resolveHermesPin();
    const keep = all ? null : enginePinDirName(pin);
    const removed: string[] = [];

    for (const dirName of listEnginePinDirs()) {
        if (keep && dirName === keep) {
            continue;
        }
        await fs.rm(path.join(engineRoot(), dirName), { force: true, recursive: true });
        removed.push(dirName);
    }

    if (removed.length === 0) {
        console.log('Nothing to clean.');
        return;
    }
    console.log(`Removed engine installs: ${removed.join(', ')}`);
    if (keep) {
        console.log(`Kept current pin: ${keep}`);
    }
}

function resolveBinaryStatus(): { binary: ResolvedHermesBinary | null; error: null | string } {
    try {
        return { binary: resolveInstalledHermesBinary(), error: null };
    } catch (err) {
        return { binary: null, error: err instanceof Error ? err.message : String(err) };
    }
}
