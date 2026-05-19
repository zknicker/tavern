import { objectSchema, optionalStringSchema, stringSchema } from './tool-contracts.js';

export function registerWorkspaceNotesTools(api, options = {}) {
    if (typeof api?.registerTool !== 'function') {
        throw new Error('Tavern Workspace tools require OpenClaw tool registration.');
    }

    const request = createWorkspaceRequest(options);

    api.registerTool({
        name: 'workspace.notes.read',
        description: 'Read the agent-authored Tavern operating notes rendered into AGENTS.md.',
        parameters: objectSchema({
            agentId: optionalStringSchema('Agent id. Defaults to main.'),
        }),
        async execute(_toolCallId, params, signal) {
            const agentId = optionalString(params?.agentId) ?? 'main';
            const notes = await request(`/workspace/agents/${encodeURIComponent(agentId)}/notes`, {
                signal,
            });
            return toolJson(notes);
        },
    });

    api.registerTool({
        name: 'workspace.notes.update',
        description:
            'Replace the agent-authored Tavern operating notes. Use this instead of editing AGENTS.md.',
        parameters: objectSchema({
            agentId: optionalStringSchema('Agent id. Defaults to main.'),
            notes: stringSchema('Concise durable operating notes to render into AGENTS.md.'),
        }),
        async execute(_toolCallId, params, signal) {
            const agentId = optionalString(params?.agentId) ?? 'main';
            return toolJson(
                await request(`/workspace/agents/${encodeURIComponent(agentId)}/notes`, {
                    body: { notes: requireString(params?.notes, 'notes') },
                    method: 'PUT',
                    signal,
                })
            );
        },
    });
}

function createWorkspaceRequest(options) {
    const baseUrl = normalizeBaseUrl(options.baseUrl ?? process.env.TAVERN_API_BASE_URL);
    const fetchImpl = options.fetch ?? globalThis.fetch;

    if (!baseUrl) {
        throw new Error('TAVERN_API_BASE_URL is required for Tavern Workspace tools.');
    }
    if (typeof fetchImpl !== 'function') {
        throw new Error('Fetch is required for Tavern Workspace tools.');
    }

    return async (path, input = {}) => {
        const response = await fetchImpl(`${baseUrl}${path}`, {
            body: input.body ? JSON.stringify(input.body) : undefined,
            headers: input.body ? { 'content-type': 'application/json' } : undefined,
            method: input.method ?? (input.body ? 'POST' : 'GET'),
            signal: input.signal,
        });

        const text = await response.text();
        const body = text ? JSON.parse(text) : null;
        if (!response.ok) {
            throw new Error(
                `Tavern Workspace request failed (${response.status}): ${formatErrorBody(body)}`
            );
        }

        return body;
    };
}

function requireString(value, name) {
    const text = optionalString(value);
    if (!text) {
        throw new Error(`${name} is required.`);
    }
    return text;
}

function optionalString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function toolJson(value) {
    return {
        content: [
            {
                text: JSON.stringify(value, null, 2),
                type: 'text',
            },
        ],
    };
}

function normalizeBaseUrl(value) {
    return typeof value === 'string' && value.trim() ? value.replace(/\/+$/u, '') : null;
}

function formatErrorBody(body) {
    if (body && typeof body === 'object' && 'error' in body) {
        return String(body.error);
    }
    return JSON.stringify(body);
}
