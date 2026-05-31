#!/usr/bin/env node

import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const bundleRoot = path.join(
    repoRoot,
    'apps',
    'website',
    'src-tauri',
    'target',
    'release',
    'bundle'
);
const macosBundleDir = path.join(bundleRoot, 'macos');
const dmgBundleDir = path.join(bundleRoot, 'dmg');

const main = async () => {
    const websitePackage = await readJson('apps/website/package.json');
    const version = websitePackage.version;
    const appPath = path.join(macosBundleDir, 'Tavern.app');
    const dmgPath = path.join(dmgBundleDir, `Tavern_${version}_aarch64.dmg`);
    const latestJsonPath = path.join(bundleRoot, 'latest.json');
    const sidecarPath = path.join(appPath, 'Contents', 'MacOS', 'tavern-server');

    await assertDirectory(appPath, 'Tavern.app');
    await assertSidecarVersion(sidecarPath, version);
    await assertFileHasContent(dmgPath, path.basename(dmgPath));

    if (await exists(latestJsonPath)) {
        const updaterArchivePath = await findSingleFile(macosBundleDir, (entry) =>
            entry.endsWith('.app.tar.gz')
        );
        const updaterSignaturePath = `${updaterArchivePath}.sig`;

        await assertFileHasContent(updaterArchivePath, path.basename(updaterArchivePath));
        await assertFileHasContent(updaterSignaturePath, path.basename(updaterSignaturePath));

        const latestJson = JSON.parse(await readFile(latestJsonPath, 'utf8'));
        assert(latestJson.version === version, 'latest.json version must match package version');
        assert(
            typeof latestJson.platforms?.['darwin-aarch64']?.url === 'string',
            'latest.json missing darwin-aarch64 update URL'
        );
        assert(
            typeof latestJson.platforms?.['darwin-aarch64']?.signature === 'string',
            'latest.json missing darwin-aarch64 signature'
        );
    }

    console.log('release:check-desktop-artifacts passed');
    console.log(`checked app: ${path.relative(repoRoot, appPath)}`);
    console.log(`checked dmg: ${path.relative(repoRoot, dmgPath)}`);
};

await main();

async function readJson(relativePath) {
    const absolutePath = path.join(repoRoot, relativePath);
    return JSON.parse(await readFile(absolutePath, 'utf8'));
}

async function exists(filePath) {
    try {
        await stat(filePath);
        return true;
    } catch {
        return false;
    }
}

async function findSingleFile(directory, predicate) {
    const matches = (await readdir(directory))
        .filter(predicate)
        .map((entry) => path.join(directory, entry));

    if (matches.length !== 1) {
        fail(
            `expected one matching file in ${path.relative(repoRoot, directory)}, found ${matches.length}`
        );
    }

    return matches[0];
}

async function assertDirectory(filePath, label) {
    const stats = await stat(filePath);
    if (!stats.isDirectory()) {
        fail(`${label} is missing or not a directory`);
    }
}

async function assertFileHasContent(filePath, label) {
    const stats = await stat(filePath);
    if (!stats.isFile() || stats.size < 1) {
        fail(`${label} is missing or empty`);
    }
}

async function assertSidecarVersion(filePath, version) {
    await assertFileHasContent(filePath, 'tavern-server sidecar');
    const binary = await readFile(filePath);
    const versionPatterns = [
        Buffer.from(`version: "${version}"`),
        Buffer.from(`"version":"${version}"`),
        Buffer.from(`"version": "${version}"`),
    ];

    if (!versionPatterns.some((pattern) => binary.includes(pattern))) {
        fail(`tavern-server sidecar does not embed app version ${version}`);
    }
}

function assert(condition, message) {
    if (!condition) {
        fail(message);
    }
}

function fail(message) {
    console.error(`release:check-desktop-artifacts error: ${message}`);
    process.exit(1);
}
