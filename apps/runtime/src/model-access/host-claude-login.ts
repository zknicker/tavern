import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { readConfigValue } from '../config';

// Detected host Claude Code login (specs/model-access.md): when the operator
// is already signed in to Claude Code on this machine, the agent engine can
// discover that credential itself, so the claude provider works with zero
// setup. Detection checks login state (keychain item / credentials file),
// never reads credential values. Runtime-owned sign-in always wins over it.

const cacheTtlMs = 60 * 1000;

let cached: { at: number; value: boolean } | null = null;

export function hasHostClaudeLogin(): boolean {
    const flag = readConfigValue('TAVERN_AGENT_CLAUDE_CODE_HOST_LOGIN');
    if (flag === '0' || flag === 'false') {
        return false;
    }
    if (cached && Date.now() - cached.at < cacheTtlMs) {
        return cached.value;
    }
    const value = detectHostClaudeLogin();
    cached = { at: Date.now(), value };
    return value;
}

export function resetHostClaudeLoginCache(): void {
    cached = null;
}

function detectHostClaudeLogin(): boolean {
    if (existsSync(path.join(homedir(), '.claude', '.credentials.json'))) {
        return true;
    }
    if (process.platform !== 'darwin') {
        return false;
    }
    try {
        // Presence check only — stdio is discarded so no credential material
        // ever reaches logs or output.
        execFileSync('security', ['find-generic-password', '-s', 'Claude Code-credentials'], {
            stdio: 'ignore',
            timeout: 3000,
        });
        return true;
    } catch {
        return false;
    }
}
