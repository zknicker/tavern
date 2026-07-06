import { createHash, randomBytes, randomUUID } from 'node:crypto';
import http from 'node:http';
import {
    type AgentRuntimeCompleteGoogleOAuth,
    type AgentRuntimeGoogleCalendarEventCreate,
    type AgentRuntimeGoogleCalendarEventCreateInput,
    type AgentRuntimeGoogleCalendarEventsList,
    type AgentRuntimeGoogleCalendarEventsListInput,
    type AgentRuntimeGoogleOAuthPoll,
    type AgentRuntimeGoogleOAuthStart,
    type AgentRuntimeGoogleSettings,
    type AgentRuntimePlugin,
    type AgentRuntimeSaveGoogleSettings,
    type AgentRuntimeStartGoogleOAuth,
    agentRuntimeCompleteGoogleOAuthSchema,
    agentRuntimeGoogleCalendarEventCreateInputSchema,
    agentRuntimeGoogleCalendarEventCreateSchema,
    agentRuntimeGoogleCalendarEventsListInputSchema,
    agentRuntimeGoogleCalendarEventsListSchema,
    agentRuntimeGoogleOAuthPollSchema,
    agentRuntimeGoogleOAuthStartSchema,
    agentRuntimeGoogleSettingsSchema,
    agentRuntimePluginSchema,
    agentRuntimeSaveGoogleSettingsSchema,
    agentRuntimeStartGoogleOAuthSchema,
} from '@tavern/api';
import {
    googleCalendarEventsScope,
    googlePluginId,
    googlePluginManifest,
} from '@tavern/api/plugins/google';
import * as z from 'zod';
import type { RuntimeCapabilityCheckResult } from '../capabilities/definitions.ts';
import {
    type GoogleOAuthCredentials,
    getRequiredGoogleOAuthCredentials,
} from './google-oauth-credentials.ts';
import {
    getPlugin,
    readPluginConfig,
    readPluginSecret,
    writePluginConfig,
    writePluginSecret,
} from './store.ts';

const googleAuthorizeEndpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
const googleTokenEndpoint = 'https://oauth2.googleapis.com/token';
const googleUserInfoEndpoint = 'https://openidconnect.googleapis.com/v1/userinfo';
const googleCalendarEventsEndpoint = 'https://www.googleapis.com/calendar/v3/calendars';
const oauthSessionTtlMs = 10 * 60 * 1000;
const tokenRefreshSkewMs = 60 * 1000;

const storedGoogleConfigSchema = z.object({
    services: z
        .object({
            calendar: z
                .object({
                    enabled: z.boolean().default(true),
                })
                .default({ enabled: true }),
        })
        .default({ calendar: { enabled: true } }),
});

const googleOAuthTokenSchema = z.object({
    accessToken: z.string().trim().min(1),
    account: z
        .object({
            email: z.string().trim().min(1).nullable().default(null),
            subject: z.string().trim().min(1).nullable().default(null),
        })
        .default({ email: null, subject: null }),
    expiresAt: z.string().datetime(),
    grantedScopes: z.array(z.string().trim().min(1)).default([]),
    refreshToken: z.string().trim().min(1).nullable().default(null),
    tokenType: z.string().trim().min(1).default('Bearer'),
});

const storedGoogleSecretSchema = z.object({
    oauth: googleOAuthTokenSchema.optional(),
});

interface OAuthSession {
    codeVerifier: string;
    errorMessage: string | null;
    expiresAt: string;
    id: string;
    redirectUri: string;
    server: http.Server | null;
    state: string;
    status: 'approved' | 'error' | 'expired' | 'pending';
}

const oauthSessions = new Map<string, OAuthSession>();

export function getGooglePlugin(): AgentRuntimePlugin {
    return agentRuntimePluginSchema.parse(getPlugin(googlePluginId));
}

export function getGoogleSettings(): AgentRuntimeGoogleSettings {
    const config = resolveGoogleConfig();
    const secret = readGoogleSecret();
    const grantedScopes = secret.oauth?.grantedScopes ?? [];
    return agentRuntimeGoogleSettingsSchema.parse({
        calendarEnabled: config.services.calendar.enabled,
        connected: Boolean(secret.oauth?.refreshToken || secret.oauth?.accessToken),
        connectedAccountEmail: secret.oauth?.account.email ?? null,
        enabled: getGooglePlugin().enabled,
        grantedScopes,
        missingCalendarScopes: missingScopes([googleCalendarEventsScope], grantedScopes),
        updatedAt: getGooglePlugin().updatedAt,
    });
}

export function saveGoogleSettings(
    input: AgentRuntimeSaveGoogleSettings
): AgentRuntimeGoogleSettings {
    const parsed = agentRuntimeSaveGoogleSettingsSchema.parse(input);
    const currentConfig = resolveGoogleConfig();
    const currentPlugin = getGooglePlugin();
    const config = {
        services: {
            calendar: {
                enabled:
                    parsed.calendarEnabled === undefined
                        ? currentConfig.services.calendar.enabled
                        : parsed.calendarEnabled,
            },
        },
    };
    writePluginConfig({
        config,
        enabled: parsed.enabled ?? currentPlugin.enabled,
        id: googlePluginId,
    });

    return getGoogleSettings();
}

export async function startGoogleOAuth(
    input: AgentRuntimeStartGoogleOAuth = {}
): Promise<AgentRuntimeGoogleOAuthStart> {
    const parsed = agentRuntimeStartGoogleOAuthSchema.parse(input);
    const credentials = getRequiredGoogleOAuthCredentials();

    const id = randomUUID();
    const state = base64Url(randomBytes(24));
    const codeVerifier = base64Url(randomBytes(48));
    const codeChallenge = base64Url(createHash('sha256').update(codeVerifier).digest());
    const expiresAt = new Date(Date.now() + oauthSessionTtlMs).toISOString();
    const session: OAuthSession = {
        codeVerifier,
        errorMessage: null,
        expiresAt,
        id,
        redirectUri: parsed.redirectUri ?? '',
        server: null,
        state,
        status: 'pending',
    };

    if (!parsed.redirectUri) {
        const server = http.createServer();
        await new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', () => resolve());
        });

        const address = server.address();
        if (!(address && typeof address === 'object')) {
            server.close();
            throw new Error('Google OAuth callback server did not start.');
        }
        session.redirectUri = `http://127.0.0.1:${address.port}/callback`;
        session.server = server;
        server.on('request', (request, response) => {
            void handleOAuthCallback({
                request,
                response,
                session,
            });
        });
    }
    oauthSessions.set(id, session);

    const authUrl = new URL(googleAuthorizeEndpoint);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('client_id', credentials.clientId);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('include_granted_scopes', 'true');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('redirect_uri', session.redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', requiredGoogleScopes().join(' '));
    authUrl.searchParams.set('state', state);

    return agentRuntimeGoogleOAuthStartSchema.parse({
        authUrl: authUrl.toString(),
        expiresAt,
        sessionId: id,
    });
}

export function pollGoogleOAuth(sessionId: string): AgentRuntimeGoogleOAuthPoll {
    const session = oauthSessions.get(sessionId);
    if (!session) {
        return agentRuntimeGoogleOAuthPollSchema.parse({
            errorMessage: 'Google OAuth session was not found.',
            sessionId,
            status: 'expired',
        });
    }
    if (session.status === 'pending' && Date.parse(session.expiresAt) <= Date.now()) {
        session.status = 'expired';
        session.errorMessage = 'Google OAuth session expired.';
        closeOAuthSession(session);
    }
    const result = agentRuntimeGoogleOAuthPollSchema.parse({
        errorMessage: session.errorMessage,
        sessionId,
        status: session.status,
    });
    if (result.status !== 'pending') {
        oauthSessions.delete(sessionId);
    }
    return result;
}

export async function completeGoogleOAuth(
    sessionId: string,
    input: AgentRuntimeCompleteGoogleOAuth
): Promise<AgentRuntimeGoogleOAuthPoll> {
    const session = oauthSessions.get(sessionId);
    if (!session) {
        return agentRuntimeGoogleOAuthPollSchema.parse({
            errorMessage: 'Google OAuth session was not found.',
            sessionId,
            status: 'expired',
        });
    }

    const parsed = agentRuntimeCompleteGoogleOAuthSchema.parse(input);
    if (session.status !== 'pending') {
        return formatOAuthPollResult(session);
    }
    if (Date.parse(session.expiresAt) <= Date.now()) {
        session.status = 'expired';
        session.errorMessage = 'Google OAuth session expired.';
        closeOAuthSession(session);
        return formatOAuthPollResult(session);
    }

    try {
        if (parsed.state !== session.state) {
            throw new Error('Google OAuth state did not match.');
        }
        if (parsed.error) {
            throw new Error(parsed.error);
        }
        if (!parsed.code) {
            throw new Error('Google OAuth did not return a code.');
        }
        const token = await exchangeOAuthCode({
            code: parsed.code,
            codeVerifier: session.codeVerifier,
            credentials: getRequiredGoogleOAuthCredentials(),
            redirectUri: session.redirectUri,
        });
        writeGoogleSecret({ ...readGoogleSecret(), oauth: token });
        saveGoogleSettings({ enabled: true });
        session.status = 'approved';
    } catch (error) {
        session.status = 'error';
        session.errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
        closeOAuthSession(session);
    }

    return formatOAuthPollResult(session);
}

export function disconnectGoogleOAuth(): AgentRuntimeGoogleSettings {
    writeGoogleSecret({});
    return getGoogleSettings();
}

export async function checkGoogleCalendarCapability(): Promise<RuntimeCapabilityCheckResult> {
    const settings = getGoogleSettings();
    if (!settings.enabled) {
        return { reason: 'Google is disabled.', state: 'unavailable' };
    }
    if (!settings.calendarEnabled) {
        return { reason: 'Google Calendar is disabled.', state: 'unavailable' };
    }
    if (!settings.connected) {
        return { reason: 'Google is not connected.', state: 'unauthorized' };
    }
    if (settings.missingCalendarScopes.length > 0) {
        return { reason: 'Google Calendar needs authorization.', state: 'unauthorized' };
    }

    try {
        await queryGoogleCalendarEvents({ maxResults: 1 });
        return {
            metadata: { account: settings.connectedAccountEmail },
            state: 'healthy',
        };
    } catch (error) {
        return {
            reason: 'Google Calendar is not reachable.',
            state: 'degraded',
            technicalMessage: error instanceof Error ? error.message : String(error),
        };
    }
}

export async function queryGoogleCalendarEvents(
    input: AgentRuntimeGoogleCalendarEventsListInput
): Promise<AgentRuntimeGoogleCalendarEventsList> {
    const parsed = agentRuntimeGoogleCalendarEventsListInputSchema.parse(input);
    const token = await getGoogleAccessToken();
    const calendarId = encodeURIComponent(parsed.calendarId);
    const url = new URL(`${googleCalendarEventsEndpoint}/${calendarId}/events`);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', String(parsed.maxResults));
    if (parsed.query) {
        url.searchParams.set('q', parsed.query);
    }
    if (parsed.timeMin) {
        url.searchParams.set('timeMin', parsed.timeMin);
    }
    if (parsed.timeMax) {
        url.searchParams.set('timeMax', parsed.timeMax);
    }
    if (parsed.timeZone) {
        url.searchParams.set('timeZone', parsed.timeZone);
    }

    const response = await fetch(url, {
        headers: { authorization: `Bearer ${token.accessToken}` },
    });
    if (!response.ok) {
        throw new Error(
            `Google Calendar request failed: ${response.status} ${await response.text()}`
        );
    }
    const body = (await response.json()) as { items?: unknown[] };
    return agentRuntimeGoogleCalendarEventsListSchema.parse({
        events: (body.items ?? []).map(projectGoogleCalendarEvent),
    });
}

export async function createGoogleCalendarEvent(
    input: AgentRuntimeGoogleCalendarEventCreateInput
): Promise<AgentRuntimeGoogleCalendarEventCreate> {
    const parsed = agentRuntimeGoogleCalendarEventCreateInputSchema.parse(input);
    const token = await getGoogleAccessToken();
    const calendarId = encodeURIComponent(parsed.calendarId);
    const response = await fetch(`${googleCalendarEventsEndpoint}/${calendarId}/events`, {
        body: JSON.stringify({
            description: parsed.description,
            end: { dateTime: parsed.endDateTime, timeZone: parsed.timeZone },
            location: parsed.location,
            start: { dateTime: parsed.startDateTime, timeZone: parsed.timeZone },
            summary: parsed.summary,
        }),
        headers: {
            authorization: `Bearer ${token.accessToken}`,
            'content-type': 'application/json',
        },
        method: 'POST',
    });
    if (!response.ok) {
        throw new Error(
            `Google Calendar event create failed: ${response.status} ${await response.text()}`
        );
    }
    return agentRuntimeGoogleCalendarEventCreateSchema.parse({
        event: projectGoogleCalendarEvent(await response.json()),
    });
}

async function handleOAuthCallback({
    request,
    response,
    session,
}: {
    request: http.IncomingMessage;
    response: http.ServerResponse;
    session: OAuthSession;
}) {
    try {
        const url = new URL(request.url ?? '/', session.redirectUri);
        if (url.pathname !== '/callback') {
            response.writeHead(404).end('Not found');
            return;
        }
        if (url.searchParams.get('state') !== session.state) {
            throw new Error('Google OAuth state did not match.');
        }
        const error = url.searchParams.get('error');
        if (error) {
            throw new Error(error);
        }
        const code = url.searchParams.get('code');
        if (!code) {
            throw new Error('Google OAuth did not return a code.');
        }
        const result = await completeGoogleOAuth(session.id, {
            code,
            state: url.searchParams.get('state') ?? '',
        });
        if (result.status !== 'approved') {
            throw new Error(result.errorMessage ?? 'Google connection failed.');
        }
        response
            .writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
            .end('<h1>Google connected</h1><p>You can close this window and return to Tavern.</p>');
    } catch (error) {
        session.status = 'error';
        session.errorMessage = error instanceof Error ? error.message : String(error);
        response
            .writeHead(400, { 'content-type': 'text/html; charset=utf-8' })
            .end(
                [
                    '<h1>Google connection failed</h1>',
                    '<p>Return to Tavern and try again.</p>',
                    `<pre>${escapeHtml(session.errorMessage ?? 'Unknown Google OAuth error.')}</pre>`,
                ].join('')
            );
    } finally {
        closeOAuthSession(session);
    }
}

async function exchangeOAuthCode({
    code,
    codeVerifier,
    credentials,
    redirectUri,
}: {
    code: string;
    codeVerifier: string;
    credentials: GoogleOAuthCredentials;
    redirectUri: string;
}) {
    const body = new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        code,
        code_verifier: codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
    });
    const response = await fetch(googleTokenEndpoint, {
        body,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        method: 'POST',
    });
    if (!response.ok) {
        throw new Error(
            `Google token exchange failed: ${response.status} ${await response.text()}`
        );
    }
    const token = (await response.json()) as Record<string, unknown>;
    const accessToken = readString(token.access_token, 'access_token');
    const account = await fetchGoogleAccount(accessToken);
    return googleOAuthTokenSchema.parse({
        accessToken,
        account,
        expiresAt: new Date(Date.now() + readExpiresIn(token.expires_in) * 1000).toISOString(),
        grantedScopes: readScopeList(token.scope),
        refreshToken: typeof token.refresh_token === 'string' ? token.refresh_token : null,
        tokenType: typeof token.token_type === 'string' ? token.token_type : 'Bearer',
    });
}

async function getGoogleAccessToken() {
    const secret = readGoogleSecret();
    if (!secret.oauth) {
        throw new Error('Google is not connected.');
    }
    if (Date.parse(secret.oauth.expiresAt) - tokenRefreshSkewMs > Date.now()) {
        return secret.oauth;
    }
    if (!secret.oauth.refreshToken) {
        throw new Error('Google OAuth refresh token is missing. Reconnect Google.');
    }
    const credentials = getRequiredGoogleOAuthCredentials();
    const body = new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: secret.oauth.refreshToken,
    });
    const response = await fetch(googleTokenEndpoint, {
        body,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        method: 'POST',
    });
    if (!response.ok) {
        throw new Error(`Google token refresh failed: ${response.status} ${await response.text()}`);
    }
    const token = (await response.json()) as Record<string, unknown>;
    const next = googleOAuthTokenSchema.parse({
        ...secret.oauth,
        accessToken: readString(token.access_token, 'access_token'),
        expiresAt: new Date(Date.now() + readExpiresIn(token.expires_in) * 1000).toISOString(),
        grantedScopes:
            typeof token.scope === 'string'
                ? readScopeList(token.scope)
                : secret.oauth.grantedScopes,
        tokenType: typeof token.token_type === 'string' ? token.token_type : secret.oauth.tokenType,
    });
    writeGoogleSecret({ ...secret, oauth: next });
    return next;
}

async function fetchGoogleAccount(accessToken: string) {
    const response = await fetch(googleUserInfoEndpoint, {
        headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
        return { email: null, subject: null };
    }
    const body = (await response.json()) as Record<string, unknown>;
    return {
        email: typeof body.email === 'string' ? body.email : null,
        subject: typeof body.sub === 'string' ? body.sub : null,
    };
}

function resolveGoogleConfig() {
    return readPluginConfig(googlePluginId, storedGoogleConfigSchema);
}

function readGoogleSecret() {
    return readPluginSecret(googlePluginId, storedGoogleSecretSchema) ?? {};
}

function writeGoogleSecret(secret: z.output<typeof storedGoogleSecretSchema>) {
    writePluginSecret({ id: googlePluginId, secret });
}

function requiredGoogleScopes() {
    return [
        ...(googlePluginManifest.auth?.baseScopes ?? []),
        ...(resolveGoogleConfig().services.calendar.enabled ? [googleCalendarEventsScope] : []),
    ];
}

function missingScopes(required: string[], granted: string[]) {
    const grantedSet = new Set(granted);
    return required.filter((scope) => !grantedSet.has(scope));
}

function projectGoogleCalendarEvent(input: unknown) {
    const event = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
    return {
        description: typeof event.description === 'string' ? event.description : null,
        end: readEventDate(event.end),
        htmlLink: typeof event.htmlLink === 'string' ? event.htmlLink : null,
        id: readString(event.id, 'id'),
        location: typeof event.location === 'string' ? event.location : null,
        start: readEventDate(event.start),
        status: typeof event.status === 'string' ? event.status : null,
        summary: typeof event.summary === 'string' ? event.summary : null,
    };
}

function readEventDate(value: unknown) {
    if (!(value && typeof value === 'object')) {
        return null;
    }
    const record = value as Record<string, unknown>;
    return typeof record.dateTime === 'string'
        ? record.dateTime
        : typeof record.date === 'string'
          ? record.date
          : null;
}

function readScopeList(value: unknown) {
    return typeof value === 'string' ? value.split(/\s+/u).filter(Boolean) : [];
}

function readExpiresIn(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 3600;
}

function readString(value: unknown, label: string) {
    if (typeof value === 'string' && value.length > 0) {
        return value;
    }
    throw new Error(`Google response did not include ${label}.`);
}

function escapeHtml(value: string) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function base64Url(buffer: Buffer) {
    return buffer.toString('base64url');
}

function closeOAuthSession(session: OAuthSession) {
    const server = session.server;
    session.server = null;
    server?.close();
}

function formatOAuthPollResult(session: OAuthSession) {
    return agentRuntimeGoogleOAuthPollSchema.parse({
        errorMessage: session.errorMessage,
        sessionId: session.id,
        status: session.status,
    });
}
