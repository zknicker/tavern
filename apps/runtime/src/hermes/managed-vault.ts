import fsSync, { type Stats } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HERMES_HOME, readConfigValue, resolveConfiguredPath } from '../config';
import { prepareVaultRoot, resolveVaultConfigSync } from '../vault/store';

export const managedVaultSkillName = 'vault';

interface ManagedVaultPackageInput {
    assetsRoot?: string;
    hermesHome?: string;
}

export interface ManagedVaultPackage {
    skillPath: string;
    vaultPath: string;
}

export function getManagedVaultSkillPath(input: ManagedVaultPackageInput = {}) {
    return path.join(input.hermesHome ?? HERMES_HOME, 'skills', managedVaultSkillName);
}

export function getManagedVaultPaths(input: ManagedVaultPackageInput = {}): ManagedVaultPackage {
    return {
        skillPath: getManagedVaultSkillPath(input),
        vaultPath: resolveManagedVaultPath(),
    };
}

export async function prepareManagedVaultPackage(
    input: ManagedVaultPackageInput = {}
): Promise<ManagedVaultPackage> {
    const assetsRoot = input.assetsRoot ?? resolveRuntimeAssetsRoot();
    const skillSource = path.join(assetsRoot, 'hermes', 'skills', managedVaultSkillName);
    const { skillPath, vaultPath } = getManagedVaultPaths(input);

    await Promise.all([
        prepareVaultRoot(vaultPath),
        syncManagedSkillDirectory(skillSource, skillPath),
    ]);

    return { skillPath, vaultPath };
}

export function resolveManagedVaultPath() {
    return resolveVaultConfigSync().vaultPath;
}

export function resolveRuntimeAssetsRoot() {
    const configured = readConfigValue('TAVERN_RUNTIME_ASSETS_DIR');
    if (configured) {
        return resolveConfiguredPath(configured);
    }

    const executableAssets = path.resolve(
        path.dirname(process.execPath),
        '..',
        'share',
        'tavern',
        'runtime-assets'
    );
    if (['tavern', 'tavern-runtime'].includes(path.basename(process.execPath))) {
        return executableAssets;
    }

    return resolveSourceAssetsRoot();
}

function resolveSourceAssetsRoot() {
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
        path.resolve(moduleDir, '..', 'assets'),
        path.resolve(moduleDir, '..', '..', 'assets'),
    ];
    return candidates.find((candidate) => fsSync.existsSync(candidate)) ?? candidates.at(-1)!;
}

interface SyncManagedSkillDirectoryOptions {
    markerContent?: string;
    markerFile?: string;
}

export async function syncManagedSkillDirectory(
    source: string,
    target: string,
    options: SyncManagedSkillDirectoryOptions = {}
) {
    await prepareExistingManagedSkillForReplacement(target);
    await fs.rm(target, { force: true, recursive: true });
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.cp(source, target, {
        errorOnExist: false,
        force: true,
        recursive: true,
        verbatimSymlinks: true,
    });
    if (options.markerFile) {
        await fs.writeFile(
            path.join(target, options.markerFile),
            options.markerContent ?? 'Managed by Tavern Runtime.\n'
        );
    }
    await protectManagedSkillDirectory(target);
}

async function prepareExistingManagedSkillForReplacement(target: string) {
    const stats = await fs.lstat(target).catch(() => null);
    if (!stats || stats.isSymbolicLink()) {
        return;
    }

    if (stats.isDirectory()) {
        await fs.chmod(target, (stats.mode | 0o700) & 0o777).catch(() => undefined);
        const entries = await fs.readdir(target);
        await Promise.all(
            entries.map((entry) =>
                prepareExistingManagedSkillForReplacement(path.join(target, entry))
            )
        );
        return;
    }

    await fs.chmod(target, (stats.mode | 0o600) & 0o777).catch(() => undefined);
}

async function protectManagedSkillDirectory(target: string) {
    const stats = await fs.lstat(target);
    if (stats.isSymbolicLink()) {
        return;
    }

    if (stats.isDirectory()) {
        const entries = await fs.readdir(target);
        await Promise.all(
            entries.map((entry) => protectManagedSkillDirectory(path.join(target, entry)))
        );
        await fs.chmod(target, readOnlyMode(stats, true)).catch(() => undefined);
        return;
    }

    await fs.chmod(target, readOnlyMode(stats, false)).catch(() => undefined);
}

function readOnlyMode(stats: Stats, directory: boolean) {
    const mode = stats.mode & 0o777;
    if (directory) {
        return (mode | 0o500) & ~0o222;
    }

    const executable = (mode & 0o111) !== 0;
    return (mode | (executable ? 0o500 : 0o400)) & ~0o222;
}
