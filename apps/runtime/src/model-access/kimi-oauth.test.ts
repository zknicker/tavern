import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { cancelKimiOAuth, pollKimiOAuth, refreshKimiTokens, startKimiOAuth } from './kimi-oauth.ts';
import {
    clearKimiCredentials,
    ensureFreshKimiCredentials,
    getKimiHarnessAuth,
    getKimiModelAccessStatus,
    hasKimiCredentials,
    loadKimiSettings,
    saveKimiOAuthCredentials,
} from './kimi-settings.ts';

const deviceAuthorizationResponse = {
    device_code: 'dev-code-1',
    expires_in: 600,
    interval: 5,
    user_code: 'ABCD-1234',
    verification_uri: 'https://kimi.com/device',
    verification_uri_complete: 'https://kimi.com/device?code=ABCD-1234',
};

const tokenResponse = {
    access_token: 'kimi-access',
    expires_in: 3600,
    refresh_token: 'kimi-refresh',
    scope: 'coding',
    token_type: 'Bearer',
};

describe('Kimi Code model access', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    it('starts a device session against the Kimi Code client', async () => {
        const calls: { body: string; url: string }[] = [];
        const start = await startKimiOAuth(fakeFetch(calls, [json(deviceAuthorizationResponse)]));

        expect(start.flow).toBe('device_code');
        expect(start.userCode).toBe('ABCD-1234');
        expect(start.verificationUrl).toBe('https://kimi.com/device?code=ABCD-1234');
        expect(start.pollInterval).toBe(5);
        expect(calls[0]?.url).toBe('https://auth.kimi.com/api/oauth/device_authorization');
        expect(calls[0]?.body).toContain('client_id=17e5f671-d194-4dfb-9706-5516cb48c098');
    });

    it('polls pending, then stores tokens on approval', async () => {
        const start = await startKimiOAuth(fakeFetch([], [json(deviceAuthorizationResponse)]));

        const pending = await pollKimiOAuth(
            start.sessionId,
            fakeFetch([], [json({ error: 'authorization_pending' }, 400)])
        );
        expect(pending.status).toBe('pending');
        expect(hasKimiCredentials()).toBe(false);

        const calls: { body: string; url: string }[] = [];
        const approved = await pollKimiOAuth(
            start.sessionId,
            fakeFetch(calls, [json(tokenResponse)])
        );
        expect(approved.status).toBe('approved');
        expect(calls[0]?.body).toContain('device_code=dev-code-1');
        expect(calls[0]?.body).toContain(
            `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:device_code')}`
        );
        expect(getKimiHarnessAuth()).toEqual({ accessToken: 'kimi-access' });
        expect(loadKimiSettings()?.refreshToken).toBe('kimi-refresh');
        expect(getKimiModelAccessStatus().state).toBe('live');

        // Later polls answer from the settled session without re-requesting.
        const settled = await pollKimiOAuth(start.sessionId, fakeFetch([], []));
        expect(settled.status).toBe('approved');
    });

    it('reports denial and expiry without storing credentials', async () => {
        const denied = await startKimiOAuth(fakeFetch([], [json(deviceAuthorizationResponse)]));
        await expect(
            pollKimiOAuth(denied.sessionId, fakeFetch([], [json({ error: 'access_denied' }, 400)]))
        ).resolves.toMatchObject({ status: 'denied' });

        const expired = await startKimiOAuth(fakeFetch([], [json(deviceAuthorizationResponse)]));
        await expect(
            pollKimiOAuth(expired.sessionId, fakeFetch([], [json({ error: 'expired_token' }, 400)]))
        ).resolves.toMatchObject({ status: 'expired' });

        expect(hasKimiCredentials()).toBe(false);
        cancelKimiOAuth(denied.sessionId);
        await expect(pollKimiOAuth(denied.sessionId, fakeFetch([], []))).resolves.toMatchObject({
            status: 'error',
        });
    });

    it('refreshes near-expiry tokens and writes them back', async () => {
        saveKimiOAuthCredentials({
            accessToken: 'stale-access',
            expiresAt: Date.now() + 60_000,
            refreshToken: 'kimi-refresh',
        });

        const calls: { body: string; url: string }[] = [];
        await ensureFreshKimiCredentials({
            fetch: fakeFetch(calls, [json({ ...tokenResponse, access_token: 'fresh-access' })]),
        });

        expect(calls[0]?.body).toContain('grant_type=refresh_token');
        expect(getKimiHarnessAuth()).toEqual({ accessToken: 'fresh-access' });
    });

    it('leaves fresh tokens untouched and clears credentials on sign-out', async () => {
        saveKimiOAuthCredentials({
            accessToken: 'fresh',
            expiresAt: Date.now() + 60 * 60 * 1000,
            refreshToken: 'kimi-refresh',
        });
        await ensureFreshKimiCredentials({
            fetch: () => {
                throw new Error('should not refresh');
            },
        });
        expect(getKimiHarnessAuth()).toEqual({ accessToken: 'fresh' });

        clearKimiCredentials();
        expect(hasKimiCredentials()).toBe(false);
        expect(getKimiModelAccessStatus().state).toBe('needs-auth');
    });

    it('surfaces refresh failures', async () => {
        await expect(
            refreshKimiTokens(
                'bad-refresh',
                fakeFetch([], [json({ error_description: 'refresh rejected' }, 401)])
            )
        ).rejects.toThrow('refresh rejected');
    });
});

function json(payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload), { status });
}

function fakeFetch(calls: { body: string; url: string }[], responses: Response[]): typeof fetch {
    let index = 0;
    return (async (url: URL | string, init?: RequestInit) => {
        calls.push({ body: String(init?.body), url: String(url) });
        const response = responses[index] ?? responses.at(-1);
        index += 1;
        if (!response) {
            throw new Error('Unexpected fetch call.');
        }
        return response.clone();
    }) as typeof fetch;
}
