import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import {
    clearAnthropicApiKey,
    getAnthropicApiKey,
    getAnthropicModelAccessStatus,
    saveAnthropicApiKey,
} from './anthropic-settings.ts';
import {
    cancelClaudeOAuth,
    pollClaudeOAuth,
    startClaudeOAuth,
    submitClaudeOAuthCode,
} from './claude-oauth.ts';
import {
    clearClaudeCredentials,
    ensureFreshClaudeCredentials,
    getClaudeHarnessAuth,
    getClaudeModelAccessStatus,
    loadClaudeSettings,
    saveClaudeOAuthCredentials,
} from './claude-settings.ts';

describe('Claude model access', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    it('starts a code-paste PKCE session with the Claude Code client', () => {
        const start = startClaudeOAuth();

        expect(start.flow).toBe('pkce');
        expect(start.sessionId.length).toBeGreaterThan(10);
        const url = new URL(start.authUrl);
        expect(url.origin).toBe('https://claude.ai');
        expect(url.searchParams.get('code')).toBe('true');
        expect(url.searchParams.get('code_challenge_method')).toBe('S256');
        expect(url.searchParams.get('client_id')).toBe('9d1c250a-e61b-44d9-88ed-5944d1962f5e');
        expect(pollClaudeOAuth(start.sessionId).status).toBe('pending');
    });

    it('exchanges a pasted code and stores runtime-owned credentials', async () => {
        const start = startClaudeOAuth();
        const calls: { body: Record<string, unknown>; url: string }[] = [];
        const fakeFetch = (async (url: URL | string, init?: RequestInit) => {
            calls.push({ body: JSON.parse(String(init?.body)), url: String(url) });
            return new Response(
                JSON.stringify({
                    access_token: 'oat-access',
                    account: { email_address: 'zach@example.com' },
                    expires_in: 3600,
                    refresh_token: 'oat-refresh',
                }),
                { status: 200 }
            );
        }) as unknown as typeof fetch;

        const result = await submitClaudeOAuthCode({
            code: 'the-code#the-state',
            fetch: fakeFetch,
            sessionId: start.sessionId,
        });

        expect(result).toEqual({ message: null, ok: true, status: 'approved' });
        expect(calls[0]?.url).toBe('https://platform.claude.com/v1/oauth/token');
        expect(calls[0]?.body.code).toBe('the-code');
        expect(calls[0]?.body.state).toBe('the-state');
        expect(calls[0]?.body.grant_type).toBe('authorization_code');

        const settings = loadClaudeSettings();
        expect(settings?.accessToken).toBe('oat-access');
        expect(settings?.refreshToken).toBe('oat-refresh');
        expect(settings?.accountEmail).toBe('zach@example.com');
        expect(getClaudeHarnessAuth()).toEqual({ authToken: 'oat-access' });
        expect(getClaudeModelAccessStatus().state).toBe('live');
        expect(pollClaudeOAuth(start.sessionId).status).toBe('approved');
    });

    it('reports expired sessions and supports cancel', async () => {
        const start = startClaudeOAuth();
        cancelClaudeOAuth(start.sessionId);

        const result = await submitClaudeOAuthCode({
            code: 'code',
            sessionId: start.sessionId,
        });

        expect(result.ok).toBe(false);
        expect(result.status).toBe('expired');
    });

    it('refreshes sign-in tokens near expiry', async () => {
        saveClaudeOAuthCredentials({
            accessToken: 'stale-token',
            expiresAt: Date.now() + 60 * 1000,
            refreshToken: 'refresh-1',
        });
        expect(getClaudeHarnessAuth()).toEqual({ authToken: 'stale-token' });

        const fakeFetch = (async () =>
            new Response(
                JSON.stringify({
                    access_token: 'fresh-token',
                    expires_in: 3600,
                    refresh_token: 'refresh-2',
                }),
                { status: 200 }
            )) as unknown as typeof fetch;
        await ensureFreshClaudeCredentials({ fetch: fakeFetch });

        const settings = loadClaudeSettings();
        expect(settings?.accessToken).toBe('fresh-token');
        expect(settings?.refreshToken).toBe('refresh-2');
        clearClaudeCredentials();
        expect(loadClaudeSettings()).toBeNull();
    });

    it('stores the Anthropic API key as its own provider credential', () => {
        expect(getAnthropicModelAccessStatus().state).toBe('needs-auth');

        saveAnthropicApiKey('sk-ant-api-key');
        expect(getAnthropicApiKey()).toBe('sk-ant-api-key');
        expect(getAnthropicModelAccessStatus().state).toBe('live');
        // The claude provider stays sign-in only.
        expect(getClaudeHarnessAuth()).toBeNull();
        expect(getClaudeModelAccessStatus().state).toBe('needs-auth');

        clearAnthropicApiKey();
        expect(getAnthropicApiKey()).toBeNull();
    });
});
