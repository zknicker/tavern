import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { readConfigValue } from '../config';

export async function resolveTavernMessengerPluginPath(openClawPackageRoot?: string) {
    const configured = readConfigValue('TAVERN_OPENCLAW_PLUGIN_PATH');
    if (configured) {
        return resolveHomePath(configured);
    }

    const deployedPath = await syncTavernMessengerPlugin(openClawPackageRoot);
    if (deployedPath) {
        return deployedPath;
    }

    return getStableTavernMessengerPluginPath();
}

async function syncTavernMessengerPlugin(openClawPackageRoot?: string) {
    const repositoryRoot = findRepositoryRoot(process.cwd());
    if (!repositoryRoot) {
        return null;
    }

    const sourcePath = path.join(repositoryRoot, 'packages', 'tavern-openclaw-messenger');
    const sourcePackageJson = path.join(sourcePath, 'package.json');
    if (!fsSync.existsSync(sourcePackageJson)) {
        return null;
    }

    const deployPath = getStableTavernMessengerPluginPath();
    if (path.resolve(sourcePath) === path.resolve(deployPath)) {
        return deployPath;
    }

    const temporaryPath = `${deployPath}.tmp-${process.pid}-${Date.now()}`;
    await fs.rm(temporaryPath, { force: true, recursive: true });
    await fs.mkdir(path.dirname(deployPath), { recursive: true });
    await fs.cp(sourcePath, temporaryPath, {
        filter: (source) => !source.includes(`${path.sep}node_modules${path.sep}`),
        recursive: true,
    });
    if (openClawPackageRoot) {
        await linkOpenClawPeerDependency(temporaryPath, openClawPackageRoot);
    }
    await fs.rm(deployPath, { force: true, recursive: true });
    await fs.rename(temporaryPath, deployPath);
    return deployPath;
}

async function linkOpenClawPeerDependency(pluginPath: string, openClawPackageRoot: string) {
    const nodeModulesPath = path.join(pluginPath, 'node_modules');
    const openClawLinkPath = path.join(nodeModulesPath, 'openclaw');

    await fs.mkdir(nodeModulesPath, { recursive: true });
    await fs.rm(openClawLinkPath, { force: true, recursive: true });
    await fs.symlink(openClawPackageRoot, openClawLinkPath, 'dir');
}

function getStableTavernMessengerPluginPath() {
    const configured = readConfigValue('TAVERN_OPENCLAW_PLUGIN_DEPLOY_PATH');
    if (configured) {
        return resolveHomePath(configured);
    }

    return path.join(os.homedir(), '.tavern', 'openclaw-plugins', 'tavern-openclaw-messenger');
}

function findRepositoryRoot(startDirectory: string) {
    let currentDirectory = path.resolve(startDirectory);

    while (true) {
        const candidate = path.join(currentDirectory, 'package.json');
        try {
            const parsed = JSON.parse(fsSync.readFileSync(candidate, 'utf8')) as {
                workspaces?: unknown;
            };
            if (Array.isArray(parsed.workspaces)) {
                return currentDirectory;
            }
        } catch {
            // Keep walking.
        }

        const parentDirectory = path.dirname(currentDirectory);
        if (parentDirectory === currentDirectory) {
            return null;
        }
        currentDirectory = parentDirectory;
    }
}

function resolveHomePath(value: string) {
    if (value === '~') {
        return process.env.HOME ?? value;
    }
    if (value.startsWith('~/')) {
        return path.join(process.env.HOME ?? '', value.slice(2));
    }
    return path.resolve(value);
}
