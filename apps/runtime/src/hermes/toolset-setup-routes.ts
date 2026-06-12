import {
    agentRuntimeSkillHubActionResultSchema,
    agentRuntimeToolsetEnvUpdateSchema,
    agentRuntimeToolsetPostSetupSchema,
    agentRuntimeToolsetProviderSelectSchema,
} from '@tavern/api';
import { json, readJson } from '../tavern/http';
import { createToolsetSetupClient } from './toolset-setup-client';

const setupSegments = new Set(['config', 'env', 'post-setup', 'provider']);

export async function handleToolsetSetupRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const toolsetId = segments[1];
    const action = segments[2];
    if (segments[0] !== 'toolsets' || !toolsetId || !action || !setupSegments.has(action)) {
        return null;
    }

    const client = createToolsetSetupClient();

    if (request.method === 'GET' && action === 'config') {
        return json(await client.getConfig(toolsetId));
    }

    if (request.method === 'PUT' && action === 'provider') {
        const input = agentRuntimeToolsetProviderSelectSchema.parse(await readJson(request));
        return json(await client.selectProvider(toolsetId, input));
    }

    if (request.method === 'PUT' && action === 'env') {
        const input = agentRuntimeToolsetEnvUpdateSchema.parse(await readJson(request));
        return json(await client.saveEnv(toolsetId, input));
    }

    if (request.method === 'POST' && action === 'post-setup') {
        const input = agentRuntimeToolsetPostSetupSchema.parse(await readJson(request));
        return json(
            agentRuntimeSkillHubActionResultSchema.parse(
                await client.runPostSetup(toolsetId, input.key)
            )
        );
    }

    return null;
}
