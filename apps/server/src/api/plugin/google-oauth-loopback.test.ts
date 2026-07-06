import { describe, expect, test } from 'bun:test';
import type { TavernAgentRuntimeClient } from '../../agent-runtime/client.ts';
import { startGoogleOAuthLoopback } from './google-oauth-loopback.ts';

describe('Google OAuth loopback callback', () => {
    test('completes a browser-local callback through Runtime', async () => {
        let redirectUri = '';
        const startClient = fakeRuntimeClient({
            async startGoogleOAuth(input) {
                redirectUri = input?.redirectUri ?? '';
                const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
                authUrl.searchParams.set('redirect_uri', redirectUri);
                authUrl.searchParams.set('state', 'state_123');
                return {
                    authUrl: authUrl.toString(),
                    expiresAt: new Date(Date.now() + 60_000).toISOString(),
                    sessionId: 'google_oauth_123',
                };
            },
        });
        const callbackClient = fakeRuntimeClient({
            async completeGoogleOAuth(sessionId, input) {
                expect(sessionId).toBe('google_oauth_123');
                expect(input).toEqual({ code: 'code_123', error: undefined, state: 'state_123' });
                return {
                    errorMessage: null,
                    sessionId,
                    status: 'approved',
                };
            },
        });

        const start = await startGoogleOAuthLoopback(startClient, () => callbackClient);
        const callbackUrl = new URL(redirectUri);
        callbackUrl.searchParams.set('state', 'state_123');
        callbackUrl.searchParams.set('code', 'code_123');

        const response = await fetch(callbackUrl);

        expect(start.sessionId).toBe('google_oauth_123');
        expect(response.status).toBe(200);
        expect(await response.text()).toContain('Google connected');
    });

    test('shows callback errors from Runtime', async () => {
        let redirectUri = '';
        const startClient = fakeRuntimeClient({
            async startGoogleOAuth(input) {
                redirectUri = input?.redirectUri ?? '';
                return {
                    authUrl: `https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=${encodeURIComponent(redirectUri)}`,
                    expiresAt: new Date(Date.now() + 60_000).toISOString(),
                    sessionId: 'google_oauth_error',
                };
            },
        });
        const callbackClient = fakeRuntimeClient({
            async completeGoogleOAuth(sessionId) {
                return {
                    errorMessage: 'Google OAuth state did not match.',
                    sessionId,
                    status: 'error',
                };
            },
        });

        await startGoogleOAuthLoopback(startClient, () => callbackClient);
        const callbackUrl = new URL(redirectUri);
        callbackUrl.searchParams.set('state', 'wrong_state');
        callbackUrl.searchParams.set('code', 'code_123');

        const response = await fetch(callbackUrl);
        const text = await response.text();

        expect(response.status).toBe(400);
        expect(text).toContain('Google connection failed');
        expect(text).toContain('Google OAuth state did not match.');
    });
});

function fakeRuntimeClient(methods: Partial<TavernAgentRuntimeClient>): TavernAgentRuntimeClient {
    return {
        close() {},
        ...methods,
    } as TavernAgentRuntimeClient;
}
