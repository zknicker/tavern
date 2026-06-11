#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdir, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadEnvFile, readJson, repoRoot } from './release-utils.mjs';

loadEnvFile();

const releaseBaseUrl = trimTrailingSlash(requireEnv('TAVERN_RELEASE_BASE_URL'));
const tapRepository = process.env.TAVERN_HOMEBREW_TAP_REPO?.trim() || 'zknicker/homebrew-tavern';
const tapDirectory = process.env.TAVERN_HOMEBREW_TAP_DIR?.trim() || cloneTapRepository();
const runtimeBundleDir = path.join(repoRoot, 'apps', 'website', 'electron-dist', 'runtime');

const main = async () => {
    const { version } = await readJson('apps/runtime/package.json');
    const artifactName = await findRuntimeArtifactName(version);
    const sha256 = readRuntimeArtifactSha256(artifactName);
    const formulaPath = path.join(tapDirectory, 'Formula', 'tavern-runtime.rb');

    await mkdir(path.dirname(formulaPath), { recursive: true });
    writeFileSync(formulaPath, renderFormula({ artifactName, sha256, version }), 'utf8');

    if (!hasGitChanges(tapDirectory)) {
        console.log(`Homebrew formula already current for v${version}`);
        return;
    }

    run('git', ['add', 'Formula/tavern-runtime.rb'], { cwd: tapDirectory });
    run('git', ['commit', '-m', `tavern-runtime ${version}`], { cwd: tapDirectory });
    run('git', ['push', 'origin', 'HEAD:main'], { cwd: tapDirectory });
    console.log(`Published Homebrew formula for v${version} to ${tapRepository}`);
};

await main();

async function findRuntimeArtifactName(version) {
    const expectedPrefix = `tavern-runtime-${version}-`;
    const entries = await readdir(runtimeBundleDir);
    const artifacts = entries.filter(
        (entry) => entry.startsWith(expectedPrefix) && entry.endsWith('.tar.gz')
    );

    if (artifacts.length !== 1) {
        fail(`expected one Runtime artifact for ${version}`, { artifacts });
    }

    return artifacts[0];
}

function readRuntimeArtifactSha256(artifactName) {
    const checksumPath = path.join(runtimeBundleDir, `${artifactName}.sha256`);
    if (!existsSync(checksumPath)) {
        fail(`missing Runtime checksum ${path.relative(repoRoot, checksumPath)}`);
    }

    const checksum = readFileSync(checksumPath, 'utf8').trim().split(/\s+/)[0];
    if (!/^[a-f0-9]{64}$/u.test(checksum)) {
        fail(`invalid Runtime checksum ${path.relative(repoRoot, checksumPath)}`);
    }

    return checksum;
}

function renderFormula(input) {
    return `class TavernRuntime < Formula
  desc "Always-on Tavern Runtime server"
  homepage "https://github.com/zknicker/tavern"
  url "${releaseBaseUrl}/${input.artifactName}"
  sha256 "${input.sha256}"
  version "${input.version}"
  license :cannot_represent

  depends_on "node"

  def install
    bin.install "bin/tavern"
    bin.install "bin/tavern-runtime"
    (share/"tavern").install "share/tavern/runtime-assets"
    (share/"tavern/node_modules/@tavern").install "share/tavern/node_modules/@tavern/sdk"
    (etc/"tavern").mkpath
    (var/"log/tavern").mkpath
  end

  service do
    run [opt_bin/"tavern", "serve"]
    environment_variables TAVERN_RUNTIME_HOST: "127.0.0.1",
      TAVERN_RUNTIME_PORT: "18790",
      PATH: "#{HOMEBREW_PREFIX}/bin:#{HOMEBREW_PREFIX}/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
    keep_alive true
    log_path var/"log/tavern/runtime.log"
    error_log_path var/"log/tavern/runtime.log"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/tavern --version")
    assert_match version.to_s, shell_output("#{bin}/tavern-runtime --version")
  end
end
`;
}

function cloneTapRepository() {
    const directory = mkdtempSync(path.join(tmpdir(), 'tavern-homebrew-tap-'));
    run('git', ['clone', `https://github.com/${tapRepository}.git`, directory], { cwd: repoRoot });
    return directory;
}

function hasGitChanges(cwd) {
    const result = spawnSync('git', ['status', '--porcelain'], {
        cwd,
        encoding: 'utf8',
    });

    if (result.error) {
        fail('git status failed', { message: result.error.message });
    }

    if (result.status !== 0) {
        fail('git status failed', { status: result.status, stderr: result.stderr });
    }

    return result.stdout.trim().length > 0;
}

function run(command, args, options = {}) {
    const result = spawnSync(command, args, {
        cwd: options.cwd ?? repoRoot,
        env: process.env,
        stdio: 'inherit',
    });

    if (result.error) {
        fail(`${command} failed`, { message: result.error.message });
    }

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

function requireEnv(name) {
    const value = process.env[name]?.trim();
    if (!value) {
        fail(`missing ${name}`);
    }

    return value;
}

function trimTrailingSlash(value) {
    return value.replace(/\/+$/u, '');
}

function fail(message, details) {
    console.error(`release:publish-homebrew-formula error: ${message}`);
    if (details) {
        console.error(JSON.stringify(details, null, 4));
    }
    process.exit(1);
}
