#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const unsignedConfig = {
    bundle: {
        targets: ['app', 'dmg'],
        macOS: {
            signingIdentity: '-',
        },
    },
};

runTauri(['build', '--config', JSON.stringify(unsignedConfig)]);

function runTauri(args) {
    const child = spawn('node', ['scripts/run-tauri.mjs', ...args], {
        cwd: repoRoot,
        env: process.env,
        stdio: 'inherit',
    });

    child.on('exit', (code, signal) => {
        if (signal) {
            process.kill(process.pid, signal);
            return;
        }

        process.exit(code ?? 1);
    });

    child.on('error', (error) => {
        console.error(error);
        process.exit(1);
    });
}
