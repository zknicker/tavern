import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { getAgentTokensDir } from '../config.ts';

const agentIdPattern = /^agt_[A-Za-z0-9_-]+$/u;
const tokenPattern = /^grta_[A-Za-z0-9_-]{43}$/u;

export function agentTokenPath(agentId: string): string {
    assertAgentId(agentId);
    return path.join(getAgentTokensDir(), agentId);
}

export function mintAgentToken(agentId: string): string {
    const token = `grta_${randomBytes(32).toString('base64url')}`;
    const filePath = agentTokenPath(agentId);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${token}\n`, { mode: 0o600 });
    fs.chmodSync(filePath, 0o600);
    return token;
}

export const rotateAgentToken = mintAgentToken;

export function readAgentToken(agentId: string): string | null {
    try {
        const token = fs.readFileSync(agentTokenPath(agentId), 'utf8').trim();
        return tokenPattern.test(token) ? token : null;
    } catch {
        return null;
    }
}

export function resolveAgentToken(providedToken: string): string | null {
    if (!tokenPattern.test(providedToken)) {
        return null;
    }
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(getAgentTokensDir(), { withFileTypes: true });
    } catch {
        return null;
    }
    for (const entry of entries) {
        if (!(entry.isFile() && agentIdPattern.test(entry.name))) {
            continue;
        }
        const expected = readAgentToken(entry.name);
        if (expected && tokensEqual(providedToken, expected)) {
            return entry.name;
        }
    }
    return null;
}

function tokensEqual(provided: string, expected: string): boolean {
    try {
        const providedHash = createHash('sha256').update(provided).digest();
        const expectedHash = createHash('sha256').update(expected).digest();
        return timingSafeEqual(providedHash, expectedHash);
    } catch {
        return false;
    }
}

function assertAgentId(agentId: string): void {
    if (!agentIdPattern.test(agentId)) {
        throw new Error('Agent token id must use an agt_ id.');
    }
}
