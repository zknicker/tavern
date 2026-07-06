import {
    agentRuntimeSkillHubAvailableSchema,
    agentRuntimeSkillHubInstallInputSchema,
    agentRuntimeSkillHubTapListSchema,
    agentRuntimeSkillHubUninstallInputSchema,
} from '@tavern/api';
import { publishSkillDeleted, publishSkillUpdated } from '../skills/events.ts';
import { badRequest, json } from '../tavern/http';
import {
    getSkillHubAvailable,
    installSkillHubSkill,
    previewSkillHubSkill,
    scanSkillHubSkill,
    uninstallSkillHubSkill,
} from './skill-hub-library.ts';

export async function handleSkillHubRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (segments[0] !== 'skills' || segments[1] !== 'hub') {
        return null;
    }

    if (request.method === 'GET' && segments[2] === 'available') {
        return json(agentRuntimeSkillHubAvailableSchema.parse(await getSkillHubAvailable()));
    }

    if (request.method === 'GET' && segments[2] === 'taps' && !segments[3]) {
        return json(agentRuntimeSkillHubTapListSchema.parse({ taps: [] }));
    }

    if (request.method === 'GET' && segments[2] === 'preview') {
        const identifier = url.searchParams.get('identifier');
        const preview = identifier ? previewSkillHubSkill(identifier) : null;
        if (!preview) {
            return badRequest(`Unknown skill: ${identifier ?? ''}`);
        }

        return json(preview);
    }

    if (request.method === 'GET' && segments[2] === 'scan') {
        const identifier = url.searchParams.get('identifier');
        const scan = identifier ? scanSkillHubSkill(identifier) : null;
        if (!scan) {
            return badRequest(`Unknown skill: ${identifier ?? ''}`);
        }

        return json(scan);
    }

    if (request.method === 'POST' && segments[2] === 'install') {
        const payload = agentRuntimeSkillHubInstallInputSchema.parse(await request.json());
        const result = await installSkillHubSkill(payload.identifier, { force: payload.force });
        if (result.ok) {
            publishSkillUpdated(skillIdFromIdentifier(payload.identifier));
        }
        return json(result);
    }

    if (request.method === 'POST' && segments[2] === 'uninstall') {
        const payload = agentRuntimeSkillHubUninstallInputSchema.parse(await request.json());
        const result = await uninstallSkillHubSkill(payload.name);
        if (result.ok) {
            publishSkillDeleted(payload.name);
        }
        return json(result);
    }

    return null;
}

function skillIdFromIdentifier(identifier: string) {
    return identifier.startsWith('builtin:') ? identifier.slice('builtin:'.length) : identifier;
}
