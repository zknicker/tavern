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
const resourcesDirectory = path.join(
    repositoryRoot,
    'apps',
    'website',
    'electron',
    'resources',
    'bin'
);
const sidecarOutputPath = path.join(
    resourcesDirectory,
    process.platform === 'win32' ? 'tavern-server.exe' : 'tavern-server'
);
const sidecarSignaturePath = `${sidecarOutputPath}.build-signature`;
const forceBuild = process.argv.includes('--force');

mkdirSync(resourcesDirectory, { recursive: true });

const sidecarSignature = createSidecarSignature();

if (!forceBuild && isCurrentSidecar(sidecarSignature)) {
    console.log(`[grotto] sidecar unchanged: ${sidecarOutputPath}`);
    process.exit(0);
}

rmSync(sidecarOutputPath, { force: true });
rmSync(`${sidecarOutputPath}.exe`, { force: true });

execFileSync('bun', ['run', '--filter', '@tavern/sdk', 'build'], {
    cwd: repositoryRoot,
    stdio: 'inherit',
});
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

    hash.update(`platform:${process.platform}\n`);
    hash.update(`arch:${process.arch}\n`);
    hash.update(`bun:${readBunVersion()}\n`);
    hashFiles(hash, [
        'bun.lock',
        'package.json',
        'apps/server/package.json',
        'apps/website/package.json',
        'apps/server/src',
        'packages',
        'scripts/build-electron-sidecar.mjs',
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
        .some((part) => ['.turbo', 'dist', 'electron-dist', 'node_modules'].includes(part));
}
