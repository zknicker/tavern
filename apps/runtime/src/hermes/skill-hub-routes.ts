import {
    agentRuntimeSkillHubActionResultSchema,
    agentRuntimeSkillHubAvailableSchema,
    agentRuntimeSkillHubInstallInputSchema,
    agentRuntimeSkillHubTapListSchema,
    agentRuntimeSkillHubUninstallInputSchema,
} from '@tavern/api';
import { badRequest, json, readJson } from '../tavern/http';
import { createSkillHubClient } from './skill-hub-client';
import { installHubSkill, uninstallHubSkill } from './skill-install';
import { getAvailableSkills } from './skill-library';
import { addSkillHubTap, listSkillHubTaps, removeSkillHubTap } from './skill-taps';

export async function handleSkillHubRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (segments[0] !== 'skills' || segments[1] !== 'hub') {
        return null;
    }

    if (segments[2] === 'taps') {
        return await handleTapsRequest(request, segments[3] ?? null);
    }

    const hub = createSkillHubClient();
    if (request.method === 'GET' && segments[2] === 'available') {
        return json(agentRuntimeSkillHubAvailableSchema.parse(await getAvailableSkills()));
    }

    if (request.method === 'GET' && segments[2] === 'preview') {
        const identifier = url.searchParams.get('identifier')?.trim();
        if (!identifier) {
            return badRequest('A skill identifier is required.');
        }
        return json(await hub.preview(identifier));
    }

    if (request.method === 'GET' && segments[2] === 'scan') {
        const identifier = url.searchParams.get('identifier')?.trim();
        if (!identifier) {
            return badRequest('A skill identifier is required.');
        }
        return json(await hub.scan(identifier));
    }

    if (request.method === 'POST' && segments[2] === 'install') {
        const input = agentRuntimeSkillHubInstallInputSchema.parse(await readJson(request));
        return json(
            agentRuntimeSkillHubActionResultSchema.parse(await installHubSkill(input.identifier))
        );
    }

    if (request.method === 'POST' && segments[2] === 'uninstall') {
        const input = agentRuntimeSkillHubUninstallInputSchema.parse(await readJson(request));
        return json(
            agentRuntimeSkillHubActionResultSchema.parse(await uninstallHubSkill(input.name))
        );
    }

    return null;
}

async function handleTapsRequest(request: Request, repo: string | null) {
    if (request.method === 'GET' && !repo) {
        return json(agentRuntimeSkillHubTapListSchema.parse(await listSkillHubTaps()));
    }

    if (request.method === 'POST' && !repo) {
        return await respondWithTapUpdate(
            async () => await addSkillHubTap(await readJson(request))
        );
    }

    if (request.method === 'DELETE' && repo) {
        return await respondWithTapUpdate(async () => await removeSkillHubTap(repo));
    }

    return null;
}

async function respondWithTapUpdate(
    update: () => Promise<Awaited<ReturnType<typeof listSkillHubTaps>>>
) {
    try {
        return json(agentRuntimeSkillHubTapListSchema.parse(await update()));
    } catch (error) {
        return badRequest(error instanceof Error ? error.message : String(error));
    }
}
