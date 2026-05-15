#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const expectedVersion = resolveExpectedVersion(process.argv.slice(2));

const versionedFiles = {
    website: 'apps/website/package.json',
    tauri: 'apps/website/src-tauri/tauri.conf.json',
    cargo: 'apps/website/src-tauri/Cargo.toml',
};

const changelogPath = 'CHANGELOG.md';

const main = async () => {
    const websitePackage = await readJson(versionedFiles.website);
    const tauriConfig = await readJson(versionedFiles.tauri);
    const cargoVersion = await readCargoVersion(versionedFiles.cargo);

    const versions = {
        website: websitePackage.version,
        tauri: tauriConfig.version,
        cargo: cargoVersion,
    };

    const releaseVersion = assertSynchronizedVersions(versions);

    assert(
        tauriConfig.identifier === 'build.tavern.desktop',
        'desktop app identifier must be build.tavern.desktop'
    );

    const changelog = await readText(changelogPath);
    assert(
        !/(^|\n)## Unreleased\s*$/m.test(changelog),
        'CHANGELOG.md must not contain ## Unreleased'
    );
    const latestRelease = parseLatestReleaseFromChangelog(changelog);

    assert(
        latestRelease.version === releaseVersion,
        'latest changelog version must match app version'
    );

    if (expectedVersion) {
        assert(
            expectedVersion === releaseVersion,
            `expected version ${expectedVersion} does not match ${releaseVersion}`
        );
    }

    console.log('release:check passed');
    console.log(`version: ${releaseVersion}`);
    console.log(`changelog date: ${latestRelease.date}`);
};

await main();

function resolveExpectedVersion(argv) {
    const expectIndex = argv.indexOf('--expect-version');
    if (expectIndex === -1) {
        const ref = process.env.GITHUB_REF ?? '';
        if (!ref.startsWith('refs/tags/v')) {
            return null;
        }

        return ref.replace('refs/tags/v', '');
    }

    const value = argv[expectIndex + 1];
    if (!value) {
        fail('missing value for --expect-version');
    }

    if (!isSemver(value)) {
        fail(`invalid --expect-version value: ${value}`);
    }

    return value;
}

function assertSynchronizedVersions(versions) {
    const unique = new Set(Object.values(versions));
    if (unique.size !== 1) {
        fail('website, Tauri, and Cargo versions are not synchronized', versions);
    }

    const [version] = unique;
    if (!isSemver(version)) {
        fail(`invalid release version: ${version}`);
    }

    return version;
}

function parseLatestReleaseFromChangelog(changelog) {
    const match = changelog.match(/^## v(\d+\.\d+\.\d+) - (\d{4}-\d{2}-\d{2})$/m);
    if (!match) {
        fail('could not find release heading in CHANGELOG.md');
    }

    return {
        version: match[1],
        date: match[2],
    };
}

async function readCargoVersion(relativePath) {
    const content = await readText(relativePath);
    const match = content.match(/^version = "(\d+\.\d+\.\d+)"/m);
    if (!match) {
        fail('could not find version in Cargo.toml');
    }

    return match[1];
}

async function readJson(relativePath) {
    const content = await readText(relativePath);
    return JSON.parse(content);
}

async function readText(relativePath) {
    const absolutePath = path.join(repoRoot, relativePath);
    return readFile(absolutePath, 'utf8');
}

function isSemver(value) {
    return /^\d+\.\d+\.\d+$/.test(value);
}

function assert(condition, message) {
    if (!condition) {
        fail(message);
    }
}

function fail(message, details) {
    console.error(`release:check error: ${message}`);
    if (details) {
        console.error(JSON.stringify(details, null, 4));
    }

    process.exit(1);
}
