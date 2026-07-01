import {
    agentRuntimeModelAccessSchema,
    agentRuntimeModelProviderApiKeyResultSchema,
    agentRuntimeRoutes,
    agentRuntimeSaveModelProviderApiKeySchema,
} from '@tavern/api';
import { runRuntimeDoctor } from '../doctor/runtime-doctor';
import { setModelProviderEnabled } from '../models/provider-store';
import { forbidden, json } from '../tavern/http';
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
        return json(agentRuntimeModelProviderApiKeyResultSchema.parse({ ok: true }));
    }

    return null;
}

async function listModelAccessStatuses() {
    const [codex, openai, openrouter] = await Promise.all([
        readCodexStatus(),
        Promise.resolve(readOpenAiStatus()),
        Promise.resolve(readOpenRouterStatus()),
    ]);
    return [codex, openai, openrouter];
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
            ? 'OpenAI API key is saved in Tavern Secret Storage.'
            : 'Add an OpenAI API key.',
        id: 'openai',
        source: settings.hasApiKey ? 'tavern-vault' : null,
        state: settings.hasApiKey ? 'live' : 'needs-auth',
    };
}

function readOpenRouterStatus() {
    const settings = getOpenRouterSettings();
    return {
        description: settings.hasApiKey
            ? 'OpenRouter API key is saved in Tavern Secret Storage.'
            : 'Add an OpenRouter API key.',
        id: 'openrouter',
        source: settings.hasApiKey ? 'tavern-vault' : null,
        state: settings.hasApiKey ? 'live' : 'needs-auth',
    };
}

function saveProviderApiKey(input: { apiKey: string; keyEnv: string }) {
    if (input.keyEnv === 'OPENAI_API_KEY' || input.keyEnv === 'TAVERN_AGENT_API_KEY') {
        saveOpenAiSettings({ apiKey: input.apiKey });
        return 'openai';
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
