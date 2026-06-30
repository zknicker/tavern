import {
    agentRuntimeSkillHubActionResultSchema,
    agentRuntimeToolConfigSchema,
    agentRuntimeToolEnvUpdateResultSchema,
    agentRuntimeToolProviderSelectResultSchema,
} from '@tavern/api';
import { json } from '../tavern/http';

const setupSegments = new Set(['config', 'env', 'post-setup', 'provider']);

export async function handleToolSetupRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const toolId = segments[1];
    const action = segments[2];
    if (segments[0] !== 'tools' || !toolId || !action || !setupSegments.has(action)) {
        return null;
    }

    if (request.method === 'GET' && action === 'config') {
        return json(
            agentRuntimeToolConfigSchema.parse({
                activeProvider: null,
                hasCategory: false,
                name: toolId,
                providers: [],
            })
        );
    }

    if (request.method === 'PUT' && action === 'provider') {
        return json(
            agentRuntimeToolProviderSelectResultSchema.parse({
                name: toolId,
                ok: false,
                provider: '',
            }),
            501
        );
    }

    if (request.method === 'PUT' && action === 'env') {
        return json(
            agentRuntimeToolEnvUpdateResultSchema.parse({
                isSet: {},
                name: toolId,
                ok: false,
                saved: [],
                skipped: [],
            }),
            501
        );
    }

    if (request.method === 'POST' && action === 'post-setup') {
        return json(
            agentRuntimeSkillHubActionResultSchema.parse({
                exitCode: null,
                log: ['Tool setup is not wired to the agent engine yet.'],
                ok: false,
            }),
            501
        );
    }

    return null;
}
