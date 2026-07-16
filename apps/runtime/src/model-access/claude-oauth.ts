import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { saveClaudeOAuthCredentials } from './claude-settings.ts';

// Claude sign-in uses the public Claude Code OAuth client with the
// code-display PKCE flow: the runtime hands the app an authorize URL, the
// user approves in a browser (any browser — the runtime can be remote), and
// pastes the displayed `code#state` back. The runtime exchanges it and owns
// the tokens from then on.

const claudeOAuthClientId = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
const claudeAuthorizeUrl = 'https://claude.ai/oauth/authorize';
const claudeTokenUrl = 'https://platform.claude.com/v1/oauth/token';
const claudeRedirectUri = 'https://console.anthropic.com/oauth/code/callback';
const claudeOAuthScopes =
    'org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload';

const sessionTtlMs = 10 * 60 * 1000;

interface ClaudePkceSession {
    createdAt: number;
    status: 'approved' | 'denied' | 'error' | 'expired' | 'pending';
    verifier: string;
}

const sessions = new Map<string, ClaudePkceSession>();

export function startClaudeOAuth(): {
    authUrl: string;
    expiresIn: number;
    flow: 'pkce';
    sessionId: string;
} {
    pruneSessions();
    const verifier = base64Url(randomBytes(32));
    const challenge = base64Url(createHash('sha256').update(verifier).digest());
    const sessionId = randomUUID();
    sessions.set(sessionId, { createdAt: Date.now(), status: 'pending', verifier });

    const url = new URL(claudeAuthorizeUrl);
    url.searchParams.set('code', 'true');
    url.searchParams.set('client_id', claudeOAuthClientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', claudeRedirectUri);
    url.searchParams.set('scope', claudeOAuthScopes);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('state', verifier);

    return {
        authUrl: url.toString(),
        expiresIn: Math.floor(sessionTtlMs / 1000),
        flow: 'pkce',
        sessionId,
    };
}

export async function submitClaudeOAuthCode(input: {
    code: string;
    fetch?: typeof fetch;
    sessionId: string;
}): Promise<{ message: string | null; ok: boolean; status: 'approved' | 'error' | 'expired' }> {
    pruneSessions();
    const session = sessions.get(input.sessionId);
    if (!session) {
        return { message: 'Sign-in session expired. Start again.', ok: false, status: 'expired' };
    }

    // The callback page displays `code#state`; accept a bare code too.
    const [code, pastedState] = input.code.trim().split('#');
    if (!code) {
        return { message: 'Enter the authorization code.', ok: false, status: 'error' };
    }

    try {
        const tokens = await exchangeClaudeCode(
            {
                code,
                state: pastedState ?? session.verifier,
                verifier: session.verifier,
            },
            input.fetch ?? fetch
        );
        saveClaudeOAuthCredentials(tokens);
        sessions.set(input.sessionId, { ...session, status: 'approved' });
        return { message: null, ok: true, status: 'approved' };
    } catch (error) {
        sessions.set(input.sessionId, { ...session, status: 'error' });
        return {
            message: error instanceof Error ? error.message : 'Claude sign-in failed.',
            ok: false,
            status: 'error',
        };
    }
}

export function pollClaudeOAuth(sessionId: string): {
    errorMessage: string | null;
    expiresAt: number | null;
    sessionId: string;
    status: 'approved' | 'denied' | 'error' | 'expired' | 'pending';
} {
    pruneSessions();
    const session = sessions.get(sessionId);
    return {
        errorMessage: null,
        expiresAt: session ? session.createdAt + sessionTtlMs : null,
        sessionId,
        status: session?.status ?? 'expired',
    };
}

export function cancelClaudeOAuth(sessionId: string): void {
    sessions.delete(sessionId);
}

export async function refreshClaudeTokens(
    refreshToken: string,
    fetchImpl: typeof fetch
): Promise<{ accessToken: string; expiresAt: number | null; refreshToken: string | null }> {
    const response = await fetchImpl(claudeTokenUrl, {
        body: JSON.stringify({
            client_id: claudeOAuthClientId,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
    });
    if (!response.ok) {
        throw new Error(`Claude sign-in refresh failed (HTTP ${response.status}).`);
    }
    return parseTokenResponse(await response.json(), refreshToken);
}

async function exchangeClaudeCode(
    input: { code: string; state: string; verifier: string },
    fetchImpl: typeof fetch
): Promise<{
    accessToken: string;
    accountEmail: string | null;
    expiresAt: number | null;
    refreshToken: string | null;
}> {
    const response = await fetchImpl(claudeTokenUrl, {
        body: JSON.stringify({
            client_id: claudeOAuthClientId,
            code: input.code,
            code_verifier: input.verifier,
            grant_type: 'authorization_code',
            redirect_uri: claudeRedirectUri,
            state: input.state,
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
    });
    if (!response.ok) {
        throw new Error(`Claude sign-in code exchange failed (HTTP ${response.status}).`);
    }
    const payload = (await response.json()) as Record<string, unknown>;
    const account = payload.account as Record<string, unknown> | undefined;
    return {
        ...parseTokenResponse(payload, null),
        accountEmail: typeof account?.email_address === 'string' ? account.email_address : null,
    };
}

function parseTokenResponse(
    payload: unknown,
    fallbackRefreshToken: string | null
): { accessToken: string; expiresAt: number | null; refreshToken: string | null } {
    const record = (payload ?? {}) as Record<string, unknown>;
    const accessToken = typeof record.access_token === 'string' ? record.access_token : '';
    if (!accessToken) {
        throw new Error('Claude sign-in returned no access token.');
    }
    const expiresIn = typeof record.expires_in === 'number' ? record.expires_in : null;
    return {
        accessToken,
        expiresAt: expiresIn === null ? null : Date.now() + expiresIn * 1000,
        refreshToken:
            typeof record.refresh_token === 'string' ? record.refresh_token : fallbackRefreshToken,
    };
}

function base64Url(buffer: Buffer): string {
    return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pruneSessions(): void {
    const now = Date.now();
    for (const [id, session] of sessions) {
        if (now - session.createdAt > sessionTtlMs) {
            sessions.delete(id);
        }
    }
}
