import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { OPENCLAW_RUN_ROOT } from '../config';

export interface SeatbeltInput {
    installPath: string | null;
    stateDir: string;
    workspaceDir: string;
}

export async function buildOpenClawLaunchCommand(
    openClawBin: string,
    input: SeatbeltInput
): Promise<string[]> {
    if (process.platform !== 'darwin') {
        throw new Error('Managed OpenClaw requires macOS Seatbelt.');
    }

    if (!hasSandboxExec()) {
        throw new Error('Managed OpenClaw requires sandbox-exec.');
    }

    const profilePath = path.join(OPENCLAW_RUN_ROOT, 'seatbelt.sb');
    await fs.mkdir(path.dirname(profilePath), { recursive: true });
    await fs.writeFile(profilePath, buildSeatbeltProfile(input), { mode: 0o600 });
    return ['sandbox-exec', '-f', profilePath, openClawBin];
}

function buildSeatbeltProfile(input: SeatbeltInput) {
    const deniedHomePaths = [
        '.aws',
        '.gnupg',
        '.kube',
        '.ssh',
        'Library/Keychains',
        'Library/Mobile Documents',
    ]
        .map((entry) => path.join(os.homedir(), entry))
        .map(escapePath);
    const allowedWritePaths = [input.stateDir, input.workspaceDir, OPENCLAW_RUN_ROOT, os.tmpdir()]
        .map(escapePath)
        .join(' ');

    return `(version 1)
(allow default)
${deniedHomePaths.map((entry) => `(deny file-read* file-write* (subpath "${entry}"))`).join('\n')}
; Seatbelt guardrails for managed OpenClaw. This is not container isolation: OpenClaw still runs
; as the current user with the inherited HOME and environment.
; Managed OpenClaw writes are expected under: ${allowedWritePaths}
`;
}

function hasSandboxExec() {
    return (
        spawnSync('sandbox-exec', ['-p', '(version 1)\n(allow default)', '/usr/bin/true'], {
            stdio: 'ignore',
        }).status === 0
    );
}

function escapePath(value: string) {
    return path.resolve(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}
