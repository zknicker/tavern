import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { log } from '../log';
import { engineInstallDir, type HermesEngineAppliedPatch, type HermesEnginePin } from './engine';
import { managedHermesSetupError } from './errors';

interface ManagedHermesEnginePatch {
    find: string;
    id: string;
    replace: string;
    target: string;
}

const managedHermesEnginePatches: ManagedHermesEnginePatch[] = [];

export const managedHermesEnginePatchManifest = managedHermesEnginePatches.map(toAppliedPatch);

export function areManagedHermesEnginePatchesCurrent(
    patches: readonly HermesEngineAppliedPatch[] | null | undefined
): boolean {
    if (!patches || patches.length !== managedHermesEnginePatchManifest.length) {
        return false;
    }
    const byId = new Map(patches.map((patch) => [patch.id, patch.checksum]));
    return managedHermesEnginePatchManifest.every((patch) => byId.get(patch.id) === patch.checksum);
}

export async function applyManagedHermesEnginePatches(
    pin: HermesEnginePin
): Promise<HermesEngineAppliedPatch[]> {
    for (const patch of managedHermesEnginePatches) {
        await applyManagedHermesEnginePatch(pin, patch);
    }
    return managedHermesEnginePatchManifest;
}

async function applyManagedHermesEnginePatch(
    pin: HermesEnginePin,
    patch: ManagedHermesEnginePatch
) {
    const targetPath = path.join(engineInstallDir(pin), patch.target);
    let source: string;
    try {
        source = await fs.readFile(targetPath, 'utf8');
    } catch (error) {
        throw managedHermesSetupError(
            `Tavern could not apply managed agent engine patch "${patch.id}" because ${targetPath} could not be read: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
    }

    if (source.includes(patch.replace)) {
        return;
    }
    if (!source.includes(patch.find)) {
        throw managedHermesSetupError(
            `Tavern could not apply managed agent engine patch "${patch.id}" because ${targetPath} no longer matches the expected source. ` +
                'Upgrade or remove the live patch before starting the managed engine.'
        );
    }

    await fs.writeFile(targetPath, source.replace(patch.find, patch.replace));
    log.info('Applied managed agent engine patch', {
        id: patch.id,
        target: patch.target,
    });
}

function toAppliedPatch(patch: ManagedHermesEnginePatch): HermesEngineAppliedPatch {
    return {
        checksum: crypto.createHash('sha256').update(JSON.stringify(patch)).digest('hex'),
        id: patch.id,
    };
}
