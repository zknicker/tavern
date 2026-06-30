import {
    agentRuntimeMcpCatalogSchema,
    agentRuntimeMcpServerListSchema,
    agentRuntimeMcpServerTestResultSchema,
    agentRuntimeSkillHubActionResultSchema,
} from '@tavern/api';
import { json } from '../tavern/http';

export async function handleMcpRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (segments[0] !== 'mcp') {
        return null;
    }

    if (request.method === 'GET' && segments[1] === 'catalog' && !segments[2]) {
        return json(agentRuntimeMcpCatalogSchema.parse({ entries: [] }));
    }

    if (request.method === 'GET' && segments[1] === 'servers' && !segments[2]) {
        return json(agentRuntimeMcpServerListSchema.parse({ servers: [] }));
    }

    if (request.method === 'POST' && segments[1] === 'servers' && segments[3] === 'test') {
        return json(
            agentRuntimeMcpServerTestResultSchema.parse({
                error: 'MCP server setup is not wired to the agent engine yet.',
                ok: false,
                tools: [],
            })
        );
    }

    if (request.method !== 'GET') {
        return json(
            agentRuntimeSkillHubActionResultSchema.parse({
                exitCode: null,
                log: ['MCP server management is not wired to the agent engine yet.'],
                ok: false,
            }),
            501
        );
    }

    return null;
}
