import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    rmSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(currentDirectory, '..');
const websiteTauriDirectory = path.join(repositoryRoot, 'apps', 'website', 'src-tauri');
const sidecarBinaryDirectory = path.join(websiteTauriDirectory, 'binaries');

const hostTriple = readRustHostTriple();
const sidecarBasename = toSidecarBasename(hostTriple);
const sidecarOutputPath = path.join(sidecarBinaryDirectory, sidecarBasename);
const sidecarSignaturePath = `${sidecarOutputPath}.build-signature`;
const forceBuild = process.argv.includes('--force');

mkdirSync(sidecarBinaryDirectory, { recursive: true });
rmSync(path.join(sidecarBinaryDirectory, `tavern-node-${hostTriple}`), { force: true });
rmSync(path.join(sidecarBinaryDirectory, `tavern-node-${hostTriple}.exe`), { force: true });
rmSync(path.join(websiteTauriDirectory, 'resources', 'server', 'index.cjs'), { force: true });

const sidecarSignature = createSidecarSignature();

if (!forceBuild && isCurrentSidecar(sidecarSignature)) {
    console.log(`[tavern] sidecar unchanged: ${sidecarOutputPath}`);
    process.exit(0);
}

rmSync(sidecarOutputPath, { force: true });
rmSync(`${sidecarOutputPath}.exe`, { force: true });

execFileSync(
    'bun',
    ['build', 'apps/server/src/index.ts', '--compile', '--outfile', sidecarOutputPath],
    {
        cwd: repositoryRoot,
        stdio: 'inherit',
    }
);
writeFileSync(sidecarSignaturePath, `${sidecarSignature}\n`);

function isCurrentSidecar(sidecarSignature) {
    if (!(existsSync(sidecarOutputPath) && existsSync(sidecarSignaturePath))) {
        return false;
    }

    return readFileSync(sidecarSignaturePath, 'utf8').trim() === sidecarSignature;
}

function createSidecarSignature() {
    const hash = createHash('sha256');

    hash.update(`host:${hostTriple}\n`);
    hash.update(`bun:${readBunVersion()}\n`);
    hashFiles(hash, [
        'bun.lock',
        'package.json',
        'apps/server/package.json',
        'apps/server/src',
        'packages',
        'scripts/build-tauri-sidecar.mjs',
    ]);

    return hash.digest('hex');
}

function readBunVersion() {
    return execFileSync('bun', ['--version'], {
        cwd: repositoryRoot,
        encoding: 'utf8',
    }).trim();
}

function hashFiles(hash, relativePaths) {
    for (const relativePath of relativePaths) {
        hashPath(hash, path.join(repositoryRoot, relativePath), relativePath);
    }
}

function hashPath(hash, absolutePath, relativePath) {
    if (!existsSync(absolutePath) || shouldIgnore(relativePath)) {
        return;
    }

    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
        for (const child of readdirSync(absolutePath).sort()) {
            hashPath(hash, path.join(absolutePath, child), path.posix.join(relativePath, child));
        }
        return;
    }

    if (!stats.isFile()) {
        return;
    }

    hash.update(`file:${relativePath}\n`);
    hash.update(readFileSync(absolutePath));
    hash.update('\n');
}

function shouldIgnore(relativePath) {
    return relativePath
        .split('/')
        .some((part) => ['.turbo', 'dist', 'node_modules'].includes(part));
}

function readRustHostTriple() {
    const rustVersion = execFileSync('rustc', ['-vV'], {
        cwd: repositoryRoot,
        encoding: 'utf8',
    });
    const hostLine = rustVersion.split('\n').find((line) => line.startsWith('host: '));

    if (!hostLine) {
        throw new Error('Unable to determine the Rust host target triple.');
    }

    return hostLine.replace('host: ', '').trim();
}

function toSidecarBasename(host) {
    if (host.includes('windows')) {
        return `tavern-server-${host}.exe`;
    }

    return `tavern-server-${host}`;
}
