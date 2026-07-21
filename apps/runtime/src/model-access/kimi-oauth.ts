import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { getOrCreateKimiDeviceId, saveKimiOAuthCredentials } from './kimi-settings.ts';

// Kimi Code sign-in uses the standard OAuth device-code flow against the
// public Kimi Code client (the same client the Kimi CLI ships): the runtime
// requests a device authorization, the app shows the user code and
// verification URL, and the runtime polls the token endpoint until the user
// approves in a browser. Tokens live in the vault from then on
// (kimi-settings.ts) and serve as the bearer for api.kimi.com/coding turns.

const kimiOAuthClientId = '17e5f671-d194-4dfb-9706-5516cb48c098';
const kimiOAuthHost = 'https://auth.kimi.com';
const deviceAuthorizationUrl = `${kimiOAuthHost}/api/oauth/device_authorization`;
const tokenUrl = `${kimiOAuthHost}/api/oauth/token`;
const deviceCodeGrant = 'urn:ietf:params:oauth:grant-type:device_code';

interface KimiDeviceSession {
    deviceCode: string;
    expiresAt: number;
    pollIntervalMs: number;
    status: 'approved' | 'denied' | 'error' | 'expired' | 'pending';
}

const sessions = new Map<string, KimiDeviceSession>();

export interface KimiOAuthStart {
    expiresIn: number;
    flow: 'device_code';
    pollInterval: number;
    sessionId: string;
    userCode: string;
    verificationUrl: string;
}

export async function startKimiOAuth(fetchImpl: typeof fetch = fetch): Promise<KimiOAuthStart> {
    pruneSessions();
    const response = await fetchImpl(deviceAuthorizationUrl, {
        body: new URLSearchParams({ client_id: kimiOAuthClientId }),
        headers: kimiOAuthHeaders(),
        method: 'POST',
    });
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!(response.ok && payload)) {
        throw new Error(`Kimi device authorization failed (HTTP ${response.status}).`);
    }

    const expiresIn = numberField(payload.expires_in) ?? 600;
    const interval = numberField(payload.interval) ?? 5;
    const sessionId = randomUUID();
    sessions.set(sessionId, {
        deviceCode: String(payload.device_code),
        expiresAt: Date.now() + expiresIn * 1000,
        pollIntervalMs: interval * 1000,
        status: 'pending',
    });

    return {
        expiresIn,
        flow: 'device_code',
        pollInterval: interval,
        sessionId,
        userCode: String(payload.user_code),
        verificationUrl: String(
            payload.verification_uri_complete ?? payload.verification_uri ?? 'https://kimi.com'
        ),
    };
}

export interface KimiOAuthPoll {
    errorMessage: null | string;
    expiresAt: null | number;
    sessionId: string;
    status: KimiDeviceSession['status'];
}

export async function pollKimiOAuth(
    sessionId: string,
    fetchImpl: typeof fetch = fetch
): Promise<KimiOAuthPoll> {
    const session = sessions.get(sessionId);
    if (!session) {
        return {
            errorMessage: 'Unknown sign-in session.',
            expiresAt: null,
            sessionId,
            status: 'error',
        };
    }
    if (session.status !== 'pending') {
        return { errorMessage: null, expiresAt: null, sessionId, status: session.status };
    }
    if (Date.now() > session.expiresAt) {
        session.status = 'expired';
        return { errorMessage: null, expiresAt: null, sessionId, status: 'expired' };
    }

    const response = await fetchImpl(tokenUrl, {
        body: new URLSearchParams({
            client_id: kimiOAuthClientId,
            device_code: session.deviceCode,
            grant_type: deviceCodeGrant,
        }),
        headers: kimiOAuthHeaders(),
        method: 'POST',
    });
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

    if (response.ok && payload?.access_token) {
        const tokens = tokensFromResponse(payload);
        saveKimiOAuthCredentials(tokens);
        session.status = 'approved';
        return { errorMessage: null, expiresAt: tokens.expiresAt, sessionId, status: 'approved' };
    }

    const error = String(payload?.error ?? '');
    if (error === 'authorization_pending' || error === 'slow_down') {
        return { errorMessage: null, expiresAt: null, sessionId, status: 'pending' };
    }
    if (error === 'expired_token') {
        session.status = 'expired';
        return { errorMessage: null, expiresAt: null, sessionId, status: 'expired' };
    }
    if (error === 'access_denied') {
        session.status = 'denied';
        return { errorMessage: null, expiresAt: null, sessionId, status: 'denied' };
    }
    session.status = 'error';
    return {
        errorMessage: String(
            payload?.error_description ?? `Kimi sign-in failed (HTTP ${response.status}).`
        ),
        expiresAt: null,
        sessionId,
        status: 'error',
    };
}

export function cancelKimiOAuth(sessionId: string): void {
    sessions.delete(sessionId);
}

export async function refreshKimiTokens(
    refreshToken: string,
    fetchImpl: typeof fetch = fetch
): Promise<{ accessToken: string; expiresAt: number | null; refreshToken: string | null }> {
    const response = await fetchImpl(tokenUrl, {
        body: new URLSearchParams({
            client_id: kimiOAuthClientId,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        }),
        headers: kimiOAuthHeaders(),
        method: 'POST',
    });
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!(response.ok && payload?.access_token)) {
        throw new Error(
            String(
                payload?.error_description ?? `Kimi token refresh failed (HTTP ${response.status}).`
            )
        );
    }
    return tokensFromResponse(payload);
}

function tokensFromResponse(payload: Record<string, unknown>) {
    const expiresIn = numberField(payload.expires_in);
    return {
        accessToken: String(payload.access_token),
        expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : null,
        refreshToken: payload.refresh_token ? String(payload.refresh_token) : null,
    };
}

function kimiOAuthHeaders(): Record<string, string> {
    return {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'KimiCLI/1.5',
        'X-Msh-Device-Id': getOrCreateKimiDeviceId(),
        'X-Msh-Device-Model': 'Tavern',
        'X-Msh-Device-Name': hostname() || 'Tavern',
    };
}

function numberField(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function pruneSessions() {
    const now = Date.now();
    for (const [sessionId, session] of sessions) {
        if (now > session.expiresAt + 60_000) {
            sessions.delete(sessionId);
        }
    }
}
