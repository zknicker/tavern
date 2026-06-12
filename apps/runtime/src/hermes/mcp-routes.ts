import {
    agentRuntimeMcpCatalogInstallSchema,
    agentRuntimeMcpServerCreateSchema,
    agentRuntimeMcpServerEnabledSchema,
    agentRuntimeSkillHubActionResultSchema,
} from '@tavern/api';
import { json, readJson } from '../tavern/http';
import { createMcpClient } from './mcp-client';

export async function handleMcpRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (segments[0] !== 'mcp') {
        return null;
    }

    const client = createMcpClient();

    if (segments[1] === 'catalog') {
        if (request.method === 'GET' && !segments[2]) {
            return json(await client.getCatalog());
        }
        if (request.method === 'POST' && segments[2] === 'install') {
            const input = agentRuntimeMcpCatalogInstallSchema.parse(await readJson(request));
            return json(
                agentRuntimeSkillHubActionResultSchema.parse(
                    await client.installCatalogEntry(input)
                )
            );
        }
        return null;
    }

    if (segments[1] !== 'servers') {
        return null;
    }

    const serverName = segments[2];
    if (request.method === 'GET' && !serverName) {
        return json(await client.listServers());
    }
    if (request.method === 'POST' && !serverName) {
        const input = agentRuntimeMcpServerCreateSchema.parse(await readJson(request));
        return json(await client.addServer(input));
    }
    if (!serverName) {
        return null;
    }
    if (request.method === 'DELETE' && !segments[3]) {
        return json(await client.removeServer(serverName));
    }
    if (request.method === 'POST' && segments[3] === 'test') {
        return json(await client.testServer(serverName));
    }
    if (request.method === 'PUT' && segments[3] === 'enabled') {
        const input = agentRuntimeMcpServerEnabledSchema.parse(await readJson(request));
        return json(await client.setServerEnabled(serverName, input.enabled));
    }

    return null;
}
