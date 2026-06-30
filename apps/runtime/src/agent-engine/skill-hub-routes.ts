import {
    type AgentRuntimeSkillHubItem,
    agentRuntimeSkillHubActionResultSchema,
    agentRuntimeSkillHubAvailableSchema,
    agentRuntimeSkillHubPreviewSchema,
    agentRuntimeSkillHubScanSchema,
    agentRuntimeSkillHubTapListSchema,
} from '@tavern/api';
import { badRequest, json } from '../tavern/http';

const tavernBuiltInSkill: AgentRuntimeSkillHubItem = {
    description: 'Tavern workspace habits, durable notes, and focused execution guidance.',
    identifier: 'builtin:tavern-workflow',
    name: 'tavern-workflow',
    repo: null,
    source: 'builtin',
    tags: ['tavern', 'workflow'],
    trustLevel: 'builtin',
};

const tavernBuiltInSkillMd = `---
summary: Tavern workflow
---

# Tavern Workflow

Use Tavern workspace context, keep durable knowledge in Vault, and keep execution focused on the active chat goal.
`;

export async function handleSkillHubRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (segments[0] !== 'skills' || segments[1] !== 'hub') {
        return null;
    }

    if (request.method === 'GET' && segments[2] === 'available') {
        return json(
            agentRuntimeSkillHubAvailableSchema.parse({
                builtin: [tavernBuiltInSkill],
                installed: {},
                taps: [],
            })
        );
    }

    if (request.method === 'GET' && segments[2] === 'taps' && !segments[3]) {
        return json(agentRuntimeSkillHubTapListSchema.parse({ taps: [] }));
    }

    if (request.method === 'GET' && segments[2] === 'preview') {
        const identifier = url.searchParams.get('identifier');
        if (identifier !== tavernBuiltInSkill.identifier) {
            return badRequest(`Unknown skill: ${identifier ?? ''}`);
        }

        return json(
            agentRuntimeSkillHubPreviewSchema.parse({
                ...tavernBuiltInSkill,
                files: ['SKILL.md'],
                skillMd: tavernBuiltInSkillMd,
            })
        );
    }

    if (request.method === 'GET' && segments[2] === 'scan') {
        const identifier = url.searchParams.get('identifier');
        if (identifier !== tavernBuiltInSkill.identifier) {
            return badRequest(`Unknown skill: ${identifier ?? ''}`);
        }

        return json(
            agentRuntimeSkillHubScanSchema.parse({
                findings: [],
                identifier: tavernBuiltInSkill.identifier,
                name: tavernBuiltInSkill.name,
                policy: 'allow',
                policyReason: 'Built-in Tavern skill.',
                severityCounts: {},
                source: tavernBuiltInSkill.source,
                summary: 'No findings.',
                trustLevel: tavernBuiltInSkill.trustLevel,
                verdict: 'allow',
            })
        );
    }

    if (request.method !== 'GET') {
        return json(
            agentRuntimeSkillHubActionResultSchema.parse({
                exitCode: null,
                log: ['Skill hub management is not wired to the agent engine yet.'],
                ok: false,
            }),
            501
        );
    }

    return null;
}
