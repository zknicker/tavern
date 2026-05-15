#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFile, readJson, readText, repoRoot } from './release-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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
const latestJsonPath = path.join(bundleRoot, 'latest.json');

loadEnvFile();

const main = async () => {
    const releaseBaseUrl = trimTrailingSlash(requireEnv('TAVERN_RELEASE_BASE_URL'));
    const version = await readReleaseVersion();
    const notes = await readReleaseNotes(version);
    const updaterArchive = await findUpdaterArchive();
    const signature = await readSignature(updaterArchive);
    const platform = readDarwinPlatform();

    const latestJson = {
        version,
        notes,
        pub_date: new Date().toISOString(),
        platforms: {
            [platform]: {
                signature,
                url: `${releaseBaseUrl}/${updaterArchive}`,
            },
        },
    };

    await writeFile(latestJsonPath, `${JSON.stringify(latestJson, null, 2)}\n`, 'utf8');

    console.log(`Wrote ${path.relative(repoRoot, latestJsonPath)}`);
    console.log(`platform: ${platform}`);
    console.log(`updater archive: ${updaterArchive}`);
};

await main();

async function readReleaseVersion() {
    const packageJson = await readJson('apps/website/package.json');
    return packageJson.version;
}

async function readReleaseNotes(version) {
    const changelog = await readText('CHANGELOG.md');
    const headingPattern = /^## v(\d+\.\d+\.\d+) - \d{4}-\d{2}-\d{2}$/gm;
    const headings = Array.from(changelog.matchAll(headingPattern));
    const targetIndex = headings.findIndex((match) => match[1] === version);

    if (targetIndex === -1) {
        fail(`could not find CHANGELOG.md entry for v${version}`);
    }

    const start = headings[targetIndex].index + headings[targetIndex][0].length;
    const end =
        targetIndex + 1 < headings.length ? headings[targetIndex + 1].index : changelog.length;
    const notes = changelog.slice(start, end).trim();

    if (!notes) {
        fail(`CHANGELOG.md entry for v${version} has no body`);
    }

    return notes;
}

async function findUpdaterArchive() {
    const entries = await readdir(macosBundleDir);
    const archive = entries.find((entry) => entry.endsWith('.app.tar.gz'));

    if (!archive) {
        fail(`could not find updater archive in ${path.relative(repoRoot, macosBundleDir)}`);
    }

    return archive;
}

async function readSignature(updaterArchive) {
    const signaturePath = path.join(macosBundleDir, `${updaterArchive}.sig`);
    try {
        return (await readFile(signaturePath, 'utf8')).trim();
    } catch {
        fail(`could not read updater signature ${path.relative(repoRoot, signaturePath)}`);
    }
}

function readDarwinPlatform() {
    if (process.platform !== 'darwin') {
        fail('desktop release metadata is currently only supported on macOS');
    }

    if (process.arch === 'arm64') {
        return 'darwin-aarch64';
    }

    if (process.arch === 'x64') {
        return 'darwin-x86_64';
    }

    fail(`unsupported macOS architecture: ${process.arch}`);
}

function requireEnv(name) {
    const value = process.env[name]?.trim();
    if (!value) {
        fail(`missing ${name}`);
    }

    return value;
}

function trimTrailingSlash(value) {
    return value.replace(/\/+$/, '');
}

function fail(message) {
    console.error(`release:create-latest-json error: ${message}`);
    process.exit(1);
}
