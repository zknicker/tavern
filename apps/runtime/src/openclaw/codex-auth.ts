import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { readConfigValue } from '../config';

export async function resolveManagedCodexAuthProfileId() {
    const configuredProfileId = readConfigValue('TAVERN_OPENCLAW_CODEX_AUTH_PROFILE_ID');
    if (configuredProfileId) {
        return configuredProfileId;
    }

    const email = await readCodexAuthEmail();
    return email ? `openai-codex:${email}` : null;
}

export function buildCodexAuthConfig(profileId: string | null | undefined) {
    if (!profileId) {
        return null;
    }

    return {
        order: {
            'openai-codex': [profileId],
        },
        profiles: {
            [profileId]: {
                mode: 'oauth',
                provider: 'openai-codex',
            },
        },
    };
}

async function readCodexAuthEmail() {
    try {
        const authPath = path.join(os.homedir(), '.codex', 'auth.json');
        const parsed = JSON.parse(await fs.readFile(authPath, 'utf8')) as {
            tokens?: { id_token?: string };
        };
        const payload = decodeJwtPayload(parsed.tokens?.id_token);
        return typeof payload.email === 'string' && payload.email.includes('@')
            ? payload.email
            : null;
    } catch {
        return null;
    }
}

function decodeJwtPayload(token: string | undefined) {
    if (!token) {
        return {};
    }

    const payload = token.split('.')[1];
    if (!payload) {
        return {};
    }

    try {
        return JSON.parse(Buffer.from(base64UrlToBase64(payload), 'base64').toString('utf8')) as {
            email?: unknown;
        };
    } catch {
        return {};
    }
}

function base64UrlToBase64(value: string) {
    const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
    return base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
}
