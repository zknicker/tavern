import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

import { OPENCLAW_INSTALL_ROOT } from '../config';
import { log } from '../log';
import type { ManagedOpenClawPluginInstallSpec } from './plugin-installs';
import { readOpenClawPackageVersion, resolveManagedOpenClawVersion } from './version';

export interface ManagedOpenClawInstall {
    binPath: string;
    codexPluginRoot: string;
    installRoot: string;
    packageRoot: string;
    version: string;
}

export async function resolveManagedOpenClawInstall(): Promise<ManagedOpenClawInstall> {
    const version = resolveManagedOpenClawVersion();
    const installRoot = path.join(OPENCLAW_INSTALL_ROOT, version);
    const binPath = path.join(OPENCLAW_INSTALL_ROOT, version, 'node_modules', '.bin', 'openclaw');
    const codexPluginRoot = path.join(
        OPENCLAW_INSTALL_ROOT,
        version,
        'node_modules',
        '@openclaw',
        'codex'
    );
    const packageRoot = path.join(OPENCLAW_INSTALL_ROOT, version, 'node_modules', 'openclaw');

    if (
        (await readOpenClawPackageVersionIfPresent(packageRoot)) !== version ||
        (await readOpenClawPackageVersionIfPresent(codexPluginRoot)) !== version
    ) {
        await installOpenClaw(version);
    }

    return {
        binPath,
        codexPluginRoot,
        installRoot,
        packageRoot,
        version,
    };
}

export async function ensureManagedOpenClawPlugins(
    install: ManagedOpenClawInstall,
    specs: ManagedOpenClawPluginInstallSpec[]
): Promise<void> {
    const installableSpecs = dedupePluginInstallSpecs(specs).filter((spec) =>
        isManagedPluginInstallSpec(install, spec)
    );
    const missingSpecs = (
        await Promise.all(
            installableSpecs.map(async (spec) =>
                (await isManagedPluginPackageInstalled(spec)) ? null : spec
            )
        )
    ).filter((spec): spec is ManagedOpenClawPluginInstallSpec => spec !== null);

    if (missingSpecs.length === 0) {
        return;
    }

    log.info('Installing managed OpenClaw plugins', {
        plugins: missingSpecs.map((spec) => spec.pluginId),
        version: install.version,
    });
    await runCommand('npm', [
        'install',
        '--prefix',
        install.installRoot,
        ...missingSpecs.map((spec) => spec.npmSpec),
        '--legacy-peer-deps',
        '--no-audit',
        '--no-fund',
    ]);
}

async function installOpenClaw(version: string): Promise<void> {
    const installRoot = path.join(OPENCLAW_INSTALL_ROOT, version);
    await fs.rm(`${installRoot}.tmp`, { force: true, recursive: true });
    await fs.mkdir(installRoot, { recursive: true });

    log.info('Installing managed OpenClaw', { installRoot, version });
    await runCommand('npm', [
        'install',
        '--prefix',
        installRoot,
        `openclaw@${version}`,
        `@openclaw/codex@${version}`,
        '--no-audit',
        '--no-fund',
    ]);
}

function dedupePluginInstallSpecs(specs: ManagedOpenClawPluginInstallSpec[]) {
    return Array.from(new Map(specs.map((spec) => [spec.pluginId, spec])).values());
}

function isManagedPluginInstallSpec(
    install: ManagedOpenClawInstall,
    spec: ManagedOpenClawPluginInstallSpec
) {
    return (
        /^[a-z][a-z0-9-]{0,63}$/u.test(spec.pluginId) &&
        isPathInside(install.installRoot, spec.installPath) &&
        spec.npmSpec.trim().length > 0
    );
}

function isPathInside(rootPath: string, candidatePath: string) {
    const relativePath = path.relative(path.resolve(rootPath), path.resolve(candidatePath));
    return relativePath === '' || !(relativePath.startsWith('..') || path.isAbsolute(relativePath));
}

async function isManagedPluginPackageInstalled(spec: ManagedOpenClawPluginInstallSpec) {
    try {
        await fs.access(path.join(spec.installPath, 'package.json'));
        return true;
    } catch {
        return false;
    }
}

function runCommand(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            env: process.env,
            stdio: 'inherit',
        });

        child.on('error', reject);
        child.on('exit', (code, signal) => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(
                new Error(`${command} ${args.join(' ')} failed (${signal ?? code ?? 'unknown'})`)
            );
        });
    });
}

async function readOpenClawPackageVersionIfPresent(packageRoot: string) {
    try {
        await fs.access(path.join(packageRoot, 'package.json'));
    } catch {
        return null;
    }
    return readOpenClawPackageVersion(packageRoot);
}
