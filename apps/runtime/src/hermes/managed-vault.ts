import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HERMES_HOME, readConfigValue, resolveConfiguredPath } from '../config';
import { prepareVaultRoot, resolveVaultConfigSync } from '../vault/store';

export const managedVaultSkillName = 'vault';

interface ManagedVaultIntegrationInput {
    assetsRoot?: string;
    hermesHome?: string;
}

export interface ManagedVaultIntegration {
    skillPath: string;
    vaultPath: string;
}

export function getManagedVaultSkillPath(input: ManagedVaultIntegrationInput = {}) {
    return path.join(input.hermesHome ?? HERMES_HOME, 'skills', managedVaultSkillName);
}

export function getManagedVaultPaths(
    input: ManagedVaultIntegrationInput = {}
): ManagedVaultIntegration {
    return {
        skillPath: getManagedVaultSkillPath(input),
        vaultPath: resolveManagedVaultPath(),
    };
}

export async function prepareManagedVaultIntegration(
    input: ManagedVaultIntegrationInput = {}
): Promise<ManagedVaultIntegration> {
    const assetsRoot = input.assetsRoot ?? resolveRuntimeAssetsRoot();
    const skillSource = path.join(assetsRoot, 'hermes', 'skills', managedVaultSkillName);
    const { skillPath, vaultPath } = getManagedVaultPaths(input);

    await Promise.all([prepareVaultRoot(vaultPath), syncDirectory(skillSource, skillPath)]);

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

export async function syncDirectory(source: string, target: string) {
    await fs.rm(target, { force: true, recursive: true });
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.cp(source, target, {
        errorOnExist: false,
        force: true,
        recursive: true,
        verbatimSymlinks: true,
    });
}
