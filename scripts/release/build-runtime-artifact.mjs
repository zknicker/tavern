#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fail, loadEnvFile, readJson, repoRoot } from './release-utils.mjs';

const artifactRoot = path.join(repoRoot, 'apps', 'website', 'electron-dist');
const runtimeArtifactDir = path.join(artifactRoot, 'runtime');
const googleOAuthClientIdEnv = 'TAVERN_GOOGLE_OAUTH_CLIENT_ID';
const googleOAuthClientSecretEnv = 'TAVERN_GOOGLE_OAUTH_CLIENT_SECRET';

loadEnvFile();

const main = async () => {
    const version = await readReleaseVersion();
    const targetTriple = readTargetTriple();
    const artifactName = `tavern-runtime-${version}-${targetTriple}.tar.gz`;
    const artifactPath = path.join(runtimeArtifactDir, artifactName);
    const checksumPath = `${artifactPath}.sha256`;
    const stageRoot = path.join(runtimeArtifactDir, 'stage');

    await fs.rm(runtimeArtifactDir, { force: true, recursive: true });
    await fs.mkdir(path.join(stageRoot, 'bin'), { recursive: true });

    run('bun', ['run', '--filter', '@tavern/runtime', 'build']);
    run('bun', [
        'build',
        'apps/runtime/src/index.ts',
        '--compile',
        '--outfile',
        path.join(stageRoot, 'bin', 'tavern'),
    ]);
    await fs.copyFile(
        path.join(stageRoot, 'bin', 'tavern'),
        path.join(stageRoot, 'bin', 'tavern-runtime')
    );

    await stageRuntimePackages(stageRoot);
    await stageRuntimeAssets(stageRoot);
    await fs.mkdir(runtimeArtifactDir, { recursive: true });
    run('tar', ['-czf', artifactPath, '-C', stageRoot, '.']);
    await fs.writeFile(checksumPath, `${await sha256File(artifactPath)}  ${artifactName}\n`);

    console.log(`Built ${path.relative(repoRoot, artifactPath)}`);
    console.log(`Wrote ${path.relative(repoRoot, checksumPath)}`);
};

await main();

async function readReleaseVersion() {
    const runtimePackageJson = await readJson('apps/runtime/package.json');
    return runtimePackageJson.version;
}

function readTargetTriple() {
    const rustVersion = execFileSync('rustc', ['-vV'], {
        cwd: repoRoot,
        encoding: 'utf8',
    });
    const hostLine = rustVersion.split('\n').find((line) => line.startsWith('host: '));
    if (!hostLine) {
        fail('unable to determine Rust host target triple');
    }
    return hostLine.replace('host: ', '').trim();
}

async function stageRuntimePackages(stageRoot) {
    const nodeModulesRoot = path.join(stageRoot, 'share', 'tavern', 'node_modules');

    await copyPackage(
        path.join(repoRoot, 'packages', 'tavern-sdk'),
        path.join(nodeModulesRoot, '@tavern', 'sdk')
    );
    await stageMemoryRecallEngine(stageRoot);
}

// qmd powers Memory recall search. It carries native modules (better-sqlite3,
// sqlite-vec, node-llama-cpp) that cannot compile into the single-file Runtime
// binary, so the Runtime dynamic-imports it from share/tavern/node_modules.
// npm (not bun) installs it so native postinstall scripts run for the build
// host platform, matching the per-platform artifact target.
async function stageMemoryRecallEngine(stageRoot) {
    const shareRoot = path.join(stageRoot, 'share', 'tavern');
    const runtimePackageJson = await readJson('apps/runtime/package.json');
    const qmdVersion = runtimePackageJson.dependencies['@tobilu/qmd'];
    if (!qmdVersion) {
        fail('apps/runtime/package.json is missing the @tobilu/qmd dependency');
    }

    await fs.mkdir(shareRoot, { recursive: true });
    execFileSync(
        'npm',
        [
            'install',
            `@tobilu/qmd@${qmdVersion}`,
            '--prefix',
            shareRoot,
            '--no-package-lock',
            '--omit=dev',
            '--no-audit',
            '--no-fund',
        ],
        { cwd: shareRoot, env: process.env, stdio: 'inherit' }
    );
    await fs.rm(path.join(shareRoot, 'package.json'), { force: true });
}

async function stageRuntimeAssets(stageRoot) {
    const runtimeAssetsRoot = path.join(stageRoot, 'share', 'tavern', 'runtime-assets');
    await fs.cp(path.join(repoRoot, 'apps', 'runtime', 'assets'), runtimeAssetsRoot, {
        recursive: true,
    });
    await stageGoogleOAuthAssets(runtimeAssetsRoot);
    await stageHarnessBridgeAssets(runtimeAssetsRoot);
}

async function stageGoogleOAuthAssets(runtimeAssetsRoot) {
    const clientId = process.env[googleOAuthClientIdEnv]?.trim();
    const clientSecret = process.env[googleOAuthClientSecretEnv]?.trim();
    if (!(clientId && clientSecret)) {
        fail('Google OAuth credentials are required for the Runtime artifact', {
            required: [googleOAuthClientIdEnv, googleOAuthClientSecretEnv],
        });
    }

    const googleAssetsRoot = path.join(runtimeAssetsRoot, 'google');
    await fs.mkdir(googleAssetsRoot, { recursive: true });
    await fs.writeFile(
        path.join(googleAssetsRoot, 'oauth-client.json'),
        `${JSON.stringify({ clientId, clientSecret }, null, 2)}\n`,
        { mode: 0o600 }
    );
}

async function stageHarnessBridgeAssets(runtimeAssetsRoot) {
    const bridgeAssetsRoot = path.join(runtimeAssetsRoot, 'harness-bridges');
    const bridgePackages = [
        {
            packageName: '@ai-sdk/harness-codex',
            targetName: 'codex',
        },
        {
            packageName: '@ai-sdk/harness-claude-code',
            targetName: 'claude-code',
        },
    ];

    await Promise.all(
        bridgePackages.map(async (bridgePackage) => {
            const sourcePath = path.join(
                repoRoot,
                'apps',
                'runtime',
                'node_modules',
                ...bridgePackage.packageName.split('/'),
                'dist',
                'bridge'
            );
            await fs.cp(sourcePath, path.join(bridgeAssetsRoot, bridgePackage.targetName), {
                recursive: true,
            });
            await overlaySourceBridgeAssets(bridgeAssetsRoot, bridgePackage.targetName);
        })
    );
}

async function overlaySourceBridgeAssets(bridgeAssetsRoot, targetName) {
    const sourcePath = path.join(
        repoRoot,
        'apps',
        'runtime',
        'assets',
        'harness-bridges',
        targetName
    );
    try {
        await fs.cp(sourcePath, path.join(bridgeAssetsRoot, targetName), {
            recursive: true,
        });
    } catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }
    }
}

async function copyPackage(sourcePath, targetPath) {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.cp(sourcePath, targetPath, {
        filter: (source) => {
            const parts = path.relative(sourcePath, source).split(path.sep);
            return !parts.some((part) => part === 'node_modules' || part === '.turbo');
        },
        recursive: true,
    });
}

function run(command, args) {
    execFileSync(command, args, {
        cwd: repoRoot,
        env: process.env,
        stdio: 'inherit',
    });
}

async function sha256File(filePath) {
    const hash = createHash('sha256');
    await new Promise((resolve, reject) => {
        createReadStream(filePath)
            .on('data', (chunk) => hash.update(chunk))
            .on('error', reject)
            .on('end', resolve);
    });
    return hash.digest('hex');
}
