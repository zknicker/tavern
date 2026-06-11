#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fail, readJson, repoRoot } from './release-utils.mjs';

const artifactRoot = path.join(repoRoot, 'apps', 'website', 'electron-dist');
const runtimeArtifactDir = path.join(artifactRoot, 'runtime');
const mnemosynePackageSpec = 'mnemosyne-hermes==0.1.5';
// Interpreter version of the pinned engine venv (see the engine pin in
// apps/runtime/src/hermes/engine.ts); the wheelhouse must match its ABI.
const enginePythonVersion = '3.11';
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
}

async function stageRuntimeAssets(stageRoot) {
    const runtimeAssetsRoot = path.join(stageRoot, 'share', 'tavern', 'runtime-assets');
    await fs.cp(path.join(repoRoot, 'apps', 'runtime', 'assets'), runtimeAssetsRoot, {
        recursive: true,
    });
    await assertStagedFile(
        path.join(runtimeAssetsRoot, 'hermes', 'installer', 'install.sh'),
        'Hermes installer snapshot'
    );
    await stageMnemosyneWheelhouse(path.join(runtimeAssetsRoot, 'python', 'mnemosyne'));
}

async function assertStagedFile(filePath, label) {
    try {
        await fs.access(filePath);
    } catch {
        throw new Error(`Runtime artifact is missing the ${label} at ${filePath}.`);
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

async function stageMnemosyneWheelhouse(wheelhousePath) {
    await fs.mkdir(wheelhousePath, { recursive: true });
    // Target the pinned engine's interpreter, not the release host's Python.
    // The engine venv installs from this wheelhouse with --no-index, so wheels
    // built for the wrong ABI (e.g. cp314 on a cp311 engine) brick agent
    // memory setup on every deployed host.
    const abis = [`cp${enginePythonVersion.replace('.', '')}`, 'abi3', 'none'];
    const platforms = [
        'macosx_11_0_arm64',
        'macosx_12_0_arm64',
        'macosx_13_0_arm64',
        'macosx_14_0_arm64',
        'macosx_15_0_arm64',
        'macosx_10_9_universal2',
        'macosx_10_12_universal2',
        'macosx_10_15_universal2',
        'macosx_11_0_universal2',
    ];
    run(process.env.PYTHON ?? 'python3', [
        '-m',
        'pip',
        'download',
        '--only-binary=:all:',
        '--python-version',
        enginePythonVersion,
        '--implementation',
        'cp',
        ...abis.flatMap((abi) => ['--abi', abi]),
        ...platforms.flatMap((platform) => ['--platform', platform]),
        '--dest',
        wheelhousePath,
        mnemosynePackageSpec,
    ]);
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
