#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const expectedVersion = resolveExpectedVersion(process.argv.slice(2));

const versionedFiles = {
    runtime: 'apps/runtime/package.json',
    website: 'apps/website/package.json',
    tauri: 'apps/website/src-tauri/tauri.conf.json',
    cargo: 'apps/website/src-tauri/Cargo.toml',
};

const changelogPath = 'CHANGELOG.md';

const main = async () => {
    const websitePackage = await readJson(versionedFiles.website);
    const runtimePackage = await readJson(versionedFiles.runtime);
    const tauriConfig = await readJson(versionedFiles.tauri);
    const cargoVersion = await readCargoVersion(versionedFiles.cargo);

    const appVersions = {
        website: websitePackage.version,
        tauri: tauriConfig.version,
        cargo: cargoVersion,
    };

    const releaseVersion = assertSynchronizedAppVersions(appVersions);
    assertRuntimeCompatibilityMetadata({
        appVersion: releaseVersion,
        requiredRuntimeVersion: websitePackage.tavern?.runtime?.minimumVersion,
        runtimeVersion: runtimePackage.version,
    });

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

function assertSynchronizedAppVersions(versions) {
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

function assertRuntimeCompatibilityMetadata(input) {
    if (!isSemver(input.runtimeVersion)) {
        fail(`invalid runtime package version: ${input.runtimeVersion}`);
    }

    if (!input.requiredRuntimeVersion) {
        fail('apps/website/package.json must declare tavern.runtime.minimumVersion');
    }

    if (!isSemver(input.requiredRuntimeVersion)) {
        fail(`invalid required Runtime version: ${input.requiredRuntimeVersion}`);
    }

    if (compareVersions(input.requiredRuntimeVersion, input.appVersion) > 0) {
        fail('required Runtime version cannot be newer than the app release version', input);
    }

    if (!isCompatibleRuntimeVersion(input.runtimeVersion, input.requiredRuntimeVersion)) {
        fail('runtime package version must satisfy the app Runtime compatibility floor', input);
    }
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

function isCompatibleRuntimeVersion(runtimeVersion, requiredRuntimeVersion) {
    const runtime = parseVersion(runtimeVersion);
    const required = parseVersion(requiredRuntimeVersion);

    return (
        runtime.major === required.major &&
        runtime.minor === required.minor &&
        compareVersions(runtimeVersion, requiredRuntimeVersion) >= 0
    );
}

function compareVersions(left, right) {
    const leftParts = parseVersion(left);
    const rightParts = parseVersion(right);

    if (leftParts.major !== rightParts.major) {
        return leftParts.major > rightParts.major ? 1 : -1;
    }

    if (leftParts.minor !== rightParts.minor) {
        return leftParts.minor > rightParts.minor ? 1 : -1;
    }

    if (leftParts.patch !== rightParts.patch) {
        return leftParts.patch > rightParts.patch ? 1 : -1;
    }

    return 0;
}

function parseVersion(value) {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
    if (!match) {
        fail(`invalid semver value: ${value}`);
    }

    return {
        major: Number.parseInt(match[1], 10),
        minor: Number.parseInt(match[2], 10),
        patch: Number.parseInt(match[3], 10),
    };
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
