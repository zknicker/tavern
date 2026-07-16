import {
    agentRuntimeModelAccessSchema,
    agentRuntimeModelProviderApiKeyResultSchema,
    agentRuntimeModelProviderOAuthPollSchema,
    agentRuntimeModelProviderOAuthStartSchema,
    agentRuntimeModelProviderOAuthSubmitSchema,
    agentRuntimeRoutes,
    agentRuntimeSaveModelProviderApiKeySchema,
    agentRuntimeSubmitModelProviderOAuthSchema,
} from '@tavern/api';
import { runRuntimeDoctor } from '../doctor/runtime-doctor';
import { setModelProviderEnabled } from '../models/provider-store';
import { forbidden, json } from '../tavern/http';
import {
    cancelClaudeOAuth,
    pollClaudeOAuth,
    startClaudeOAuth,
    submitClaudeOAuthCode,
} from './claude-oauth';
import { getClaudeModelAccessStatus, saveClaudeApiKey } from './claude-settings';
import { getCodexModelAccessStatus } from './codex-settings';
import { getOpenAiSettings, saveOpenAiSettings } from './openai-settings';
import { getOpenRouterSettings } from './openrouter-settings';

export async function handleModelAccessRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.modelAccess) {
        return json(
            agentRuntimeModelAccessSchema.parse({
                providers: await listModelAccessStatuses(),
            })
        );
    }

    if (request.method === 'PUT' && url.pathname === agentRuntimeRoutes.modelAccessApiKey) {
        const forbiddenResponse = requireTavernMutation(request, 'Model provider API keys');
        if (forbiddenResponse) {
            return forbiddenResponse;
        }
        const input = agentRuntimeSaveModelProviderApiKeySchema.parse(await readJson(request));
        const providerId = saveProviderApiKey(input);
        await setModelProviderEnabled({ enabled: true, providerId });
        await runRuntimeDoctor({
            modules: ['models', 'agents'],
            reason: 'provider_changed',
            scope: { kind: 'provider', providerId },
        });
        // Lazy import: capability checks read model settings from this module tree.
        void import('../capabilities/store.ts')
            .then((store) =>
                store.refreshRuntimeCapabilities({
                    ids: ['memoryExtraction', 'memoryDreaming'],
                    publishUpdated: true,
                })
            )
            .catch(() => {});
        return json(agentRuntimeModelProviderApiKeyResultSchema.parse({ ok: true }));
    }

    const oauthResponse = await handleClaudeOAuthRequest(request, url);
    if (oauthResponse) {
        return oauthResponse;
    }

    return null;
}

// Claude sign-in (code-paste PKCE): the only provider whose OAuth the
// runtime executes itself; codex and friends authenticate externally.
async function handleClaudeOAuthRequest(request: Request, url: URL): Promise<Response | null> {
    if (
        request.method === 'POST' &&
        url.pathname === agentRuntimeRoutes.modelAccessOAuthStart('claude')
    ) {
        const forbiddenResponse = requireTavernMutation(request, 'Claude sign-in');
        if (forbiddenResponse) {
            return forbiddenResponse;
        }
        return json(agentRuntimeModelProviderOAuthStartSchema.parse(startClaudeOAuth()));
    }

    if (
        request.method === 'POST' &&
        url.pathname === agentRuntimeRoutes.modelAccessOAuthSubmit('claude')
    ) {
        const forbiddenResponse = requireTavernMutation(request, 'Claude sign-in');
        if (forbiddenResponse) {
            return forbiddenResponse;
        }
        const input = agentRuntimeSubmitModelProviderOAuthSchema.parse({
            ...((await readJson(request)) as Record<string, unknown>),
            providerId: 'claude',
        });
        const result = await submitClaudeOAuthCode(input);
        if (result.ok) {
            await setModelProviderEnabled({ enabled: true, providerId: 'claude' });
            await runRuntimeDoctor({
                modules: ['models', 'agents'],
                reason: 'provider_changed',
                scope: { kind: 'provider', providerId: 'claude' },
            });
            void import('../capabilities/store.ts')
                .then((store) =>
                    store.refreshRuntimeCapabilities({
                        ids: ['claudeAuth'],
                        publishUpdated: true,
                    })
                )
                .catch(() => {});
        }
        return json(agentRuntimeModelProviderOAuthSubmitSchema.parse(result));
    }

    const pollMatch = url.pathname.match(/^\/model-access\/oauth\/claude\/poll\/([^/]+)$/u);
    if (request.method === 'GET' && pollMatch?.[1]) {
        return json(
            agentRuntimeModelProviderOAuthPollSchema.parse(
                pollClaudeOAuth(decodeURIComponent(pollMatch[1]))
            )
        );
    }

    const cancelMatch = url.pathname.match(/^\/model-access\/oauth\/sessions\/([^/]+)$/u);
    if (request.method === 'DELETE' && cancelMatch?.[1]) {
        cancelClaudeOAuth(decodeURIComponent(cancelMatch[1]));
        return json({ ok: true });
    }

    return null;
}

async function listModelAccessStatuses() {
    const [claude, codex, openai, openrouter] = await Promise.all([
        Promise.resolve(readClaudeStatus()),
        readCodexStatus(),
        Promise.resolve(readOpenAiStatus()),
        Promise.resolve(readOpenRouterStatus()),
    ]);
    return [claude, codex, openai, openrouter];
}

function readClaudeStatus() {
    try {
        return getClaudeModelAccessStatus();
    } catch {
        return {
            description: 'Connect Claude to run Claude-powered agents.',
            id: 'claude',
            source: null,
            state: 'needs-auth',
        };
    }
}

async function readCodexStatus() {
    try {
        return await getCodexModelAccessStatus();
    } catch (error) {
        return {
            description:
                error instanceof Error && error.name === 'CodexUsageParseError'
                    ? 'Codex OAuth auth is invalid. Sign in with Codex again.'
                    : 'Codex OAuth auth could not be read.',
            id: 'codex',
            source: null,
            state: 'error',
        };
    }
}

function readOpenAiStatus() {
    const settings = getOpenAiSettings();
    return {
        description: settings.hasApiKey
            ? 'OpenAI API key is saved in secure storage.'
            : 'Add an OpenAI API key.',
        id: 'openai',
        source: settings.hasApiKey ? 'secure-storage' : null,
        state: settings.hasApiKey ? 'live' : 'needs-auth',
    };
}

function readOpenRouterStatus() {
    const settings = getOpenRouterSettings();
    return {
        description: settings.hasApiKey
            ? 'OpenRouter API key is saved in secure storage.'
            : 'Add an OpenRouter API key.',
        id: 'openrouter',
        source: settings.hasApiKey ? 'secure-storage' : null,
        state: settings.hasApiKey ? 'live' : 'needs-auth',
    };
}

function saveProviderApiKey(input: { apiKey: string; keyEnv: string }) {
    if (input.keyEnv === 'OPENAI_API_KEY' || input.keyEnv === 'TAVERN_AGENT_API_KEY') {
        saveOpenAiSettings({ apiKey: input.apiKey });
        return 'openai';
    }
    if (input.keyEnv === 'ANTHROPIC_API_KEY') {
        saveClaudeApiKey(input.apiKey);
        return 'claude';
    }
    throw new Error(`Unsupported model provider API key "${input.keyEnv}".`);
}

function requireTavernMutation(request: Request, label: string) {
    if (request.headers.get('x-tavern-origin') === 'tavern') {
        return null;
    }
    return forbidden(`${label} require a Tavern caller.`);
}

async function readJson(request: Request): Promise<unknown> {
    return await request.json().catch(() => ({}));
}
