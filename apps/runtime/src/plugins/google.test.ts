import { googleCalendarEventsScope } from '@tavern/api/plugins/google';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import {
    completeGoogleOAuth,
    disconnectGoogleOAuth,
    getGoogleSettings,
    saveGoogleSettings,
    startGoogleOAuth,
} from './google';
import { getPlugin, writePluginSecret } from './store';

describe('Google Plugin settings', () => {
    const originalClientId = process.env.TAVERN_GOOGLE_OAUTH_CLIENT_ID;
    const originalClientSecret = process.env.TAVERN_GOOGLE_OAUTH_CLIENT_SECRET;

    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
        restoreEnv('TAVERN_GOOGLE_OAUTH_CLIENT_ID', originalClientId);
        restoreEnv('TAVERN_GOOGLE_OAUTH_CLIENT_SECRET', originalClientSecret);
        vi.restoreAllMocks();
    });

    test('rejects enabling Google before OAuth connects', () => {
        expect(() => saveGoogleSettings({ enabled: true })).toThrow(
            'Connect Google before enabling the Google Plugin.'
        );
        expect(getGoogleSettings()).toMatchObject({ connected: false, enabled: false });
    });

    test('stores Google config in Plugin tables', () => {
        connectGoogle();
        const settings = saveGoogleSettings({
            calendarEnabled: true,
            enabled: true,
        });

        expect(settings).toMatchObject({
            calendarEnabled: true,
            connected: true,
            enabled: true,
        });
        expect(getPlugin('google').services[0]).toMatchObject({
            enabled: true,
            id: 'calendar',
        });
        expect(
            getDb()
                .prepare('SELECT config_json FROM runtime_plugins WHERE id = $id')
                .get({ $id: 'google' })
        ).toMatchObject({
            config_json: JSON.stringify({
                services: { calendar: { enabled: true } },
            }),
        });
    });

    test('disconnecting Google disables the Plugin', () => {
        connectGoogle();
        saveGoogleSettings({ enabled: true });

        const settings = disconnectGoogleOAuth();

        expect(settings).toMatchObject({ connected: false, enabled: false });
    });

    test('completes OAuth through a caller-owned loopback redirect', async () => {
        process.env.TAVERN_GOOGLE_OAUTH_CLIENT_ID = 'google-client-id';
        process.env.TAVERN_GOOGLE_OAUTH_CLIENT_SECRET = 'google-client-secret';
        const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
            if (String(url) === 'https://oauth2.googleapis.com/token') {
                expect(String(init?.body)).toContain(
                    'redirect_uri=http%3A%2F%2F127.0.0.1%3A43210%2Fcallback'
                );
                return new Response(
                    JSON.stringify({
                        access_token: 'access-token',
                        expires_in: 3600,
                        refresh_token: 'refresh-token',
                        scope: googleCalendarEventsScope,
                        token_type: 'Bearer',
                    }),
                    { headers: { 'content-type': 'application/json' }, status: 200 }
                );
            }

            if (String(url) === 'https://openidconnect.googleapis.com/v1/userinfo') {
                return new Response(JSON.stringify({ email: 'zach@example.com', sub: 'sub_123' }), {
                    headers: { 'content-type': 'application/json' },
                    status: 200,
                });
            }

            return new Response('unexpected request', { status: 500 });
        });
        vi.stubGlobal('fetch', fetchMock);

        const start = await startGoogleOAuth({
            redirectUri: 'http://127.0.0.1:43210/callback',
        });
        const authUrl = new URL(start.authUrl);
        const result = await completeGoogleOAuth(start.sessionId, {
            code: 'auth-code',
            state: authUrl.searchParams.get('state') ?? '',
        });

        expect(result).toMatchObject({ sessionId: start.sessionId, status: 'approved' });
        expect(getGoogleSettings()).toMatchObject({
            connected: true,
            connectedAccountEmail: 'zach@example.com',
            missingCalendarScopes: [],
        });
    });
});

function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) {
        delete process.env[key];
    } else {
        process.env[key] = value;
    }
}

function connectGoogle() {
    writePluginSecret({
        id: 'google',
        secret: {
            oauth: {
                accessToken: 'access-token',
                account: {
                    email: 'zach@example.com',
                    subject: 'sub_123',
                },
                expiresAt: new Date(Date.now() + 60_000).toISOString(),
                grantedScopes: [googleCalendarEventsScope],
                refreshToken: 'refresh-token',
                tokenType: 'Bearer',
            },
        },
    });
}
