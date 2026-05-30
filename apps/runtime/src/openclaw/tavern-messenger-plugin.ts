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

    const deployedPath = await syncTavernPluginPackage({
        openClawPackageRoot,
        packageDirectory: 'tavern-openclaw-messenger',
        stableDirectoryName: 'tavern-openclaw-messenger',
    });
    if (deployedPath) {
        return deployedPath;
    }

    return getStableTavernMessengerPluginPath();
}

export async function resolveTavernCortexPluginPath(openClawPackageRoot?: string) {
    const configured = readConfigValue('TAVERN_OPENCLAW_CORTEX_PLUGIN_PATH');
    if (configured) {
        return resolveHomePath(configured);
    }

    const deployedPath = await syncTavernPluginPackage({
        openClawPackageRoot,
        packageDirectory: 'tavern-openclaw-cortex',
        stableDirectoryName: 'tavern-openclaw-cortex',
    });
    if (deployedPath) {
        return deployedPath;
    }

    return getStableTavernCortexPluginPath();
}

export async function resolveTavernWorkspacePluginPath(openClawPackageRoot?: string) {
    const configured = readConfigValue('TAVERN_OPENCLAW_WORKSPACE_PLUGIN_PATH');
    if (configured) {
        return resolveHomePath(configured);
    }

    const deployedPath = await syncTavernPluginPackage({
        openClawPackageRoot,
        packageDirectory: 'tavern-openclaw-workspace',
        stableDirectoryName: 'tavern-openclaw-workspace',
    });
    if (deployedPath) {
        return deployedPath;
    }

    return getStableTavernWorkspacePluginPath();
}

async function syncTavernPluginPackage(input: {
    openClawPackageRoot?: string;
    packageDirectory: string;
    stableDirectoryName: string;
}) {
    const source = findPluginPackageSource(input.packageDirectory);
    if (!source) {
        return null;
    }

    const sourcePackageJson = path.join(source.sourcePath, 'package.json');
    if (!fsSync.existsSync(sourcePackageJson)) {
        return null;
    }

    const deployPath = getStableTavernPluginPath(input.stableDirectoryName);
    if (path.resolve(source.sourcePath) === path.resolve(deployPath)) {
        return deployPath;
    }

    const temporaryPath = `${deployPath}.tmp-${process.pid}-${Date.now()}`;
    await fs.rm(temporaryPath, { force: true, recursive: true });
    await fs.mkdir(path.dirname(deployPath), { recursive: true });
    await fs.cp(source.sourcePath, temporaryPath, {
        filter: (source) => !source.includes(`${path.sep}node_modules${path.sep}`),
        recursive: true,
    });
    if (input.openClawPackageRoot) {
        await linkOpenClawPeerDependency(temporaryPath, input.openClawPackageRoot);
    }
    await linkPackageDependency({
        packageName: '@tavern/sdk',
        pluginPath: temporaryPath,
        packagePath: source.sdkPath,
        rootPath: source.rootPath,
    });
    await fs.rm(deployPath, { force: true, recursive: true });
    await fs.rename(temporaryPath, deployPath);
    return deployPath;
}

function findPluginPackageSource(packageDirectory: string) {
    const repositoryRoot = findRepositoryRoot(process.cwd());
    if (repositoryRoot) {
        return {
            rootPath: repositoryRoot,
            sdkPath: path.join(repositoryRoot, 'packages', 'tavern-sdk'),
            sourcePath: path.join(repositoryRoot, 'packages', packageDirectory),
        };
    }

    const packagedRoot = findPackagedRuntimeRoot();
    if (!packagedRoot) {
        return null;
    }

    return {
        rootPath: packagedRoot,
        sdkPath: path.join(packagedRoot, 'share', 'tavern', 'node_modules', '@tavern', 'sdk'),
        sourcePath: path.join(
            packagedRoot,
            'share',
            'tavern',
            'openclaw-plugins',
            packageDirectory
        ),
    };
}

async function linkOpenClawPeerDependency(pluginPath: string, openClawPackageRoot: string) {
    const nodeModulesPath = path.join(pluginPath, 'node_modules');
    const openClawLinkPath = path.join(nodeModulesPath, 'openclaw');

    await fs.mkdir(nodeModulesPath, { recursive: true });
    await fs.rm(openClawLinkPath, { force: true, recursive: true });
    await fs.symlink(openClawPackageRoot, openClawLinkPath, 'dir');
}

async function linkPackageDependency(input: {
    packageName: string;
    pluginPath: string;
    packagePath: string;
    rootPath: string;
}) {
    if (!fsSync.existsSync(path.join(input.packagePath, 'package.json'))) {
        return;
    }

    const nodeModulesPath = path.join(input.pluginPath, 'node_modules');
    const packageLinkPath = path.join(nodeModulesPath, ...input.packageName.split('/'));

    if (!isPathInside(input.rootPath, input.packagePath)) {
        throw new Error(`Refusing to link package dependency outside root: ${input.packageName}`);
    }

    await fs.mkdir(path.dirname(packageLinkPath), { recursive: true });
    await fs.rm(packageLinkPath, { force: true, recursive: true });
    await fs.symlink(input.packagePath, packageLinkPath, 'dir');
}

function isPathInside(rootPath: string, candidatePath: string) {
    const relativePath = path.relative(path.resolve(rootPath), path.resolve(candidatePath));
    return relativePath === '' || !(relativePath.startsWith('..') || path.isAbsolute(relativePath));
}

function getStableTavernMessengerPluginPath() {
    const configured = readConfigValue('TAVERN_OPENCLAW_PLUGIN_DEPLOY_PATH');
    if (configured) {
        return resolveHomePath(configured);
    }

    return getStableTavernPluginPath('tavern-openclaw-messenger');
}

function getStableTavernCortexPluginPath() {
    const configured = readConfigValue('TAVERN_OPENCLAW_CORTEX_PLUGIN_DEPLOY_PATH');
    if (configured) {
        return resolveHomePath(configured);
    }

    return getStableTavernPluginPath('tavern-openclaw-cortex');
}

function getStableTavernWorkspacePluginPath() {
    const configured = readConfigValue('TAVERN_OPENCLAW_WORKSPACE_PLUGIN_DEPLOY_PATH');
    if (configured) {
        return resolveHomePath(configured);
    }

    return getStableTavernPluginPath('tavern-openclaw-workspace');
}

function getStableTavernPluginPath(directoryName: string) {
    return path.join(os.homedir(), '.tavern', 'openclaw-plugins', directoryName);
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

function findPackagedRuntimeRoot() {
    const executablePath = process.execPath;
    if (!executablePath) {
        return null;
    }

    let currentDirectory = path.dirname(executablePath);

    while (true) {
        const candidate = path.join(currentDirectory, 'share', 'tavern', 'openclaw-plugins');
        if (fsSync.existsSync(candidate)) {
            return currentDirectory;
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
