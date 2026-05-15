#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { loadEnvFile, repoRoot } from './release-utils.mjs';

loadEnvFile();

const s3Uri = trimTrailingSlash(requireEnv('TAVERN_RELEASE_S3_URI'));
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
    const artifacts = [
        path.join(bundleRoot, 'latest.json'),
        ...(await findFiles(dmgBundleDir, (entry) => entry.endsWith('.dmg'))),
        ...(await findFiles(macosBundleDir, (entry) => entry.endsWith('.app.tar.gz'))),
        ...(await findFiles(macosBundleDir, (entry) => entry.endsWith('.app.tar.gz.sig'))),
    ];

    for (const artifact of artifacts) {
        runAws(['s3', 'cp', artifact, `${s3Uri}/${path.basename(artifact)}`]);
    }

    console.log(`Published ${artifacts.length} desktop release artifacts to ${s3Uri}`);
};

await main();

async function findFiles(directory, predicate) {
    const entries = await readdir(directory);
    return entries.filter(predicate).map((entry) => path.join(directory, entry));
}

function runAws(args) {
    const result = spawnSync('aws', args, {
        cwd: repoRoot,
        env: process.env,
        stdio: 'inherit',
    });

    if (result.error) {
        console.error(result.error);
        process.exit(1);
    }

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

function requireEnv(name) {
    const value = process.env[name]?.trim();
    if (!value) {
        console.error(`release:publish-desktop error: missing ${name}`);
        process.exit(1);
    }

    return value;
}

function trimTrailingSlash(value) {
    return value.replace(/\/+$/, '');
}
