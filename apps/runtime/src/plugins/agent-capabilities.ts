import type { AgentRuntimeAgent, AgentRuntimeSkillSummary, AgentRuntimeTool } from '@tavern/api';
import { type TavernPluginManifest, tavernPluginManifests } from '@tavern/api/plugins';
import { getPlugin } from './store.ts';

const emptyRequirements = {
    anyBins: [],
    bins: [],
    config: [],
    env: [],
    os: [],
};

export interface PluginSkillBundle {
    content: string;
    description: string;
    files: [];
    id: string;
    name: string;
    path: null;
}

export function listPluginSkillSummaries(input: { agent?: AgentRuntimeAgent | null } = {}) {
    return tavernPluginManifests.flatMap((definition) => {
        if (!isPluginGranted(definition, input.agent)) {
            return [];
        }
        const plugin = getPlugin(definition.id);
        if (!plugin.enabled) {
            return [];
        }

        return definition.skills.map(
            (skill): AgentRuntimeSkillSummary => ({
                allowedTools: pluginToolNames(definition).join(', '),
                baseDir: null,
                bundled: true,
                commandVisible: true,
                configChecks: [],
                description: definition.description,
                disabled: false,
                eligible: true,
                filePath: null,
                id: skill.name,
                install: [],
                missing: emptyRequirements,
                modelVisible: true,
                name: skill.name,
                requirements: emptyRequirements,
                runtimeSource: skill.runtimeSource,
                source: 'builtin',
                updatedAt: plugin.updatedAt,
                userInvocable: true,
            })
        );
    });
}

export function readPluginSkillBundlesForAgent(agent: AgentRuntimeAgent): PluginSkillBundle[] {
    return tavernPluginManifests.flatMap((definition) => {
        if (!isPluginGranted(definition, agent)) {
            return [];
        }
        const plugin = getPlugin(definition.id);
        if (!plugin.enabled) {
            return [];
        }

        return definition.skills.map((skill) => ({
            content: pluginSkillContent(definition),
            description: definition.description,
            files: [],
            id: skill.name,
            name: skill.name,
            path: null,
        }));
    });
}

export function readPluginSkillContent(input: {
    agent?: AgentRuntimeAgent | null;
    skillId: string;
}) {
    const definition = tavernPluginManifests.find((candidate) =>
        candidate.skills.some((skill) => skill.name === input.skillId)
    );
    if (!(definition && isPluginGranted(definition, input.agent))) {
        return null;
    }
    const plugin = getPlugin(definition.id);
    return plugin.enabled ? pluginSkillContent(definition) : null;
}

export function listPluginToolGroups(): AgentRuntimeTool[] {
    return tavernPluginManifests.flatMap((definition) => {
        const plugin = getPlugin(definition.id);
        return definition.toolGroups.map((toolGroup) => ({
            configured: plugin.enabled && plugin.secrets.length > 0,
            description: toolGroup.description,
            enabled: plugin.enabled,
            id: toolGroup.id,
            label: toolGroup.label,
            name: toolGroup.id,
            readOnly: true,
            tools: [...toolGroup.tools],
        }));
    });
}

function isPluginGranted(definition: TavernPluginManifest, agent: AgentRuntimeAgent | null = null) {
    return agent ? (agent.enabledPluginIds ?? []).includes(definition.id) : true;
}

function pluginToolNames(definition: TavernPluginManifest) {
    return definition.toolGroups.flatMap((group) => group.tools);
}

function pluginSkillContent(definition: TavernPluginManifest) {
    const tools = pluginToolNames(definition)
        .map((toolName) => `- ${toolName}`)
        .join('\n');

    return `# ${definition.displayName}

${definition.description}

Use these read-only Tavern Plugin tools when the user asks for ${definition.displayName} data:

${tools}

Do not run setup, sync, ingestion, account switching, or secret changes from chat. Those stay in Tavern Plugin settings.
`;
}
