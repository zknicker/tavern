import { spawn } from 'node:child_process';
import type { AgentRuntimeSkillHubActionResult } from '@tavern/api';
import { HERMES_HOME } from '../config';
import { resolveInstalledHermesBinary } from './bootstrap';
import { findInstalledHubEntry, readInstalledHubSkills } from './skill-library';

const actionTimeoutMs = 180_000;

export interface SkillInstallOptions {
    binaryPath?: string;
    home?: string;
    timeoutMs?: number;
}

/**
 * Install and uninstall hub skills by running the engine CLI directly.
 *
 * The engine dashboard's endpoints are broken in the pinned engine: install
 * spawns the CLI without `--yes`, so the confirmation prompt reads EOF and
 * cancels while still exiting 0; uninstall passes `--yes` to a subcommand that
 * doesn't define it, so argparse dies with a usage dump. Runtime therefore
 * runs the CLI itself — `--yes` for install, a piped confirmation for
 * uninstall — and treats the hub lockfile, not the exit code, as the source of
 * truth for whether the change landed.
 */
export async function installHubSkill(
    identifier: string,
    options?: SkillInstallOptions
): Promise<AgentRuntimeSkillHubActionResult> {
    const home = options?.home ?? HERMES_HOME;
    const run = await runEngineCli(
        ['skills', 'install', identifier, '--yes'],
        { ...options, home },
        null
    );

    const installed = await readInstalledHubSkills({ home }).catch(() => ({}));
    return {
        exitCode: run.exitCode,
        log: run.log,
        ok: findInstalledHubEntry(identifier, installed) !== undefined,
    };
}

export async function uninstallHubSkill(
    name: string,
    options?: SkillInstallOptions
): Promise<AgentRuntimeSkillHubActionResult> {
    const home = options?.home ?? HERMES_HOME;
    // The uninstall subcommand has no --yes flag; answer its confirm prompt.
    const run = await runEngineCli(['skills', 'uninstall', name], { ...options, home }, 'y\n');

    const installed = await readInstalledHubSkills({ home }).catch(() => ({}));
    const stillInstalled = Object.values(installed).some((entry) => entry.name === name);
    return {
        exitCode: run.exitCode,
        log: run.log,
        ok: !stillInstalled,
    };
}

async function runEngineCli(
    args: string[],
    options: SkillInstallOptions,
    stdinInput: null | string
): Promise<{ exitCode: null | number; log: string[] }> {
    const binaryPath = options.binaryPath ?? resolveInstalledHermesBinary()?.binaryPath;
    if (!binaryPath) {
        throw new Error('The agent engine binary is not available for skill installs.');
    }

    return await new Promise((resolve, reject) => {
        const child = spawn(binaryPath, args, {
            env: { ...process.env, HERMES_HOME: options.home ?? HERMES_HOME },
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        let output = '';
        const timer = setTimeout(() => {
            child.kill('SIGKILL');
        }, options.timeoutMs ?? actionTimeoutMs);

        child.stdout.on('data', (chunk: Buffer) => {
            output += chunk.toString();
        });
        child.stderr.on('data', (chunk: Buffer) => {
            output += chunk.toString();
        });
        if (stdinInput !== null) {
            child.stdin.write(stdinInput);
        }
        child.stdin.end();
        child.on('error', (error) => {
            clearTimeout(timer);
            reject(error);
        });
        child.on('close', (exitCode) => {
            clearTimeout(timer);
            resolve({ exitCode, log: toLogLines(output) });
        });
    });
}

function toLogLines(output: string) {
    return output
        .split('\n')
        .map((line) => stripAnsi(line).trim())
        .filter((line) => line.length > 0)
        .slice(-40);
}

function stripAnsi(value: string) {
    return value.replaceAll(/\u001B\[[0-9;]*m/gu, '');
}
