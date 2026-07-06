import type { AgentRuntimeAgent, AgentRuntimeSkillSummary, AgentRuntimeTool } from '@tavern/api';
import {
    type TavernPluginManifest,
    type TavernPluginServiceManifest,
    tavernPluginManifests,
} from '@tavern/api/plugins';
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

        return enabledPluginServices(definition, plugin.config).flatMap((service) =>
            service.skills.map(
                (skill): AgentRuntimeSkillSummary => ({
                    allowedTools: serviceToolNames(service).join(', '),
                    baseDir: null,
                    bundled: true,
                    commandVisible: true,
                    configChecks: [],
                    description: service.description,
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
            )
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

        return enabledPluginServices(definition, plugin.config).flatMap((service) =>
            service.skills.map((skill) => ({
                content: pluginSkillContent(service),
                description: service.description,
                files: [],
                id: skill.name,
                name: skill.name,
                path: null,
            }))
        );
    });
}

export function readPluginSkillContent(input: {
    agent?: AgentRuntimeAgent | null;
    skillId: string;
}) {
    const match = findPluginServiceForSkill(input.skillId);
    if (!(match && isPluginGranted(match.definition, input.agent))) {
        return null;
    }
    const plugin = getPlugin(match.definition.id);
    return plugin.enabled && isPluginServiceEnabled(match.service, plugin.config)
        ? pluginSkillContent(match.service)
        : null;
}

export function isPluginSkillId(skillId: string) {
    return tavernPluginManifests.some((definition) =>
        definition.services.some((service) =>
            service.skills.some((skill) => skill.name === skillId)
        )
    );
}

export function listPluginToolGroups(): AgentRuntimeTool[] {
    return tavernPluginManifests.flatMap((definition) => {
        const plugin = getPlugin(definition.id);
        return enabledPluginServices(definition, plugin.config).flatMap((service) =>
            service.toolGroups.map((toolGroup) => ({
                configured: plugin.enabled && plugin.secrets.length > 0,
                description: toolGroup.description,
                enabled: plugin.enabled,
                id: toolGroup.id,
                label: toolGroup.label,
                name: toolGroup.id,
                readOnly: true,
                tools: [...toolGroup.tools],
            }))
        );
    });
}

function isPluginGranted(definition: TavernPluginManifest, agent: AgentRuntimeAgent | null = null) {
    return agent ? (agent.enabledPluginIds ?? []).includes(definition.id) : true;
}

function enabledPluginServices(definition: TavernPluginManifest, config: Record<string, unknown>) {
    return definition.services.filter((service) => isPluginServiceEnabled(service, config));
}

function isPluginServiceEnabled(
    service: TavernPluginServiceManifest,
    config: Record<string, unknown>
) {
    const services = config.services;
    if (!(services && typeof services === 'object' && !Array.isArray(services))) {
        return service.defaultEnabled;
    }
    const serviceConfig = (services as Record<string, unknown>)[service.id];
    if (!(serviceConfig && typeof serviceConfig === 'object' && !Array.isArray(serviceConfig))) {
        return service.defaultEnabled;
    }
    const enabled = (serviceConfig as Record<string, unknown>).enabled;
    return typeof enabled === 'boolean' ? enabled : service.defaultEnabled;
}

function findPluginServiceForSkill(skillId: string) {
    for (const definition of tavernPluginManifests) {
        for (const service of definition.services) {
            if (service.skills.some((skill) => skill.name === skillId)) {
                return { definition, service };
            }
        }
    }
    return null;
}

function serviceToolNames(service: TavernPluginServiceManifest) {
    return service.toolGroups.flatMap((group) => group.tools);
}

function pluginSkillContent(service: TavernPluginServiceManifest) {
    const tools = serviceToolNames(service)
        .map((toolName) => `- ${toolName}`)
        .join('\n');

    return `# ${service.displayName}

${service.description}

Use these read-only Tavern Plugin tools when the user asks for ${service.displayName} data:

${tools}

Do not run setup, sync, ingestion, account switching, or secret changes from chat. Those stay in Tavern Plugin settings.
`;
}
