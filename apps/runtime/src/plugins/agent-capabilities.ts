import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentRuntimeAgent, AgentRuntimeTool } from '@tavern/api';
import {
    type TavernPluginManifest,
    type TavernPluginServiceManifest,
    tavernPluginManifests,
} from '@tavern/api/plugins';
import { type WidgetName, widgetNameSchema } from '@tavern/api/widgets';
import { AGENT_HOME } from '../config.ts';
import { readSkillSource } from '../skills/store.ts';
import { browserSkillContent } from './browser/browser-skill.generated.ts';
import { getPlugin } from './store.ts';

const pluginOwnedWidgetNames = new Set<WidgetName>(
    tavernPluginManifests.flatMap((definition) => definition.widgets.map((widget) => widget.name))
);

/**
 * Widget names the agent may author: core widgets (owned by no Plugin) plus the
 * widgets of each Plugin that is enabled and explicitly granted to this agent.
 * Returned in canonical widget order so the generated prompt stays stable
 * regardless of grant order. Unlike catalog listings, an unresolved (null)
 * agent is treated as holding no grants: a plugin widget is only advertised
 * when the grant is confirmed, so we never tell an agent to author a widget it
 * cannot use.
 */
export function availableWidgetNamesForAgent(agent: AgentRuntimeAgent | null = null): WidgetName[] {
    const grantedPluginIds = new Set(agent?.enabledPluginIds ?? []);
    const grantedPluginWidgetNames = new Set<WidgetName>(
        tavernPluginManifests
            .filter(
                (definition) =>
                    grantedPluginIds.has(definition.id) && getPlugin(definition.id).enabled
            )
            .flatMap((definition) => definition.widgets.map((widget) => widget.name))
    );

    return widgetNameSchema.options.filter(
        (name) => !pluginOwnedWidgetNames.has(name) || grantedPluginWidgetNames.has(name)
    );
}

export interface PluginSkillBundle {
    content: string;
    description: string;
    files: [];
    id: string;
    name: string;
    path: null;
}

export async function readPluginSkillBundlesForAgent(
    agent: AgentRuntimeAgent,
    input: { skillsDir?: string } = {}
): Promise<PluginSkillBundle[]> {
    const bundles: PluginSkillBundle[] = [];
    const seen = new Set<string>();
    const skillsDir = input.skillsDir ?? path.join(AGENT_HOME, 'skills');

    for (const definition of tavernPluginManifests) {
        if (!isPluginGranted(definition, agent)) {
            continue;
        }
        const plugin = getPlugin(definition.id);
        if (!plugin.enabled) {
            continue;
        }

        for (const service of enabledPluginServices(definition, plugin.config)) {
            for (const skill of service.skills) {
                if (seen.has(skill.name)) {
                    continue;
                }
                seen.add(skill.name);
                bundles.push({
                    content: await readMaterializedPluginSkillContent({
                        generatedContent: pluginSkillContent(service),
                        skillId: skill.name,
                        skillsDir,
                    }),
                    description: service.description,
                    files: [],
                    id: skill.name,
                    name: skill.name,
                    path: null,
                });
            }
        }
    }

    return bundles;
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
                // A secretless plugin is configured whenever it is enabled.
                configured:
                    plugin.enabled &&
                    (definition.secrets.length === 0 || plugin.secrets.length > 0),
                description: toolGroup.description,
                enabled: plugin.enabled,
                id: toolGroup.id,
                label: toolGroup.label,
                name: toolGroup.id,
                readOnly: toolGroup.readOnly,
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

export function isPluginServiceEnabled(
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

export function findPluginServiceForSkill(skillId: string) {
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

export function pluginSkillContent(service: TavernPluginServiceManifest) {
    // The Browser skill is vendored from the upstream agent-browser skill and
    // kept current with scripts/sync-browser-skill.mjs rather than generated
    // from the manifest template.
    if (service.id === 'browser') {
        return browserSkillContent;
    }

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

async function readMaterializedPluginSkillContent(input: {
    generatedContent: string;
    skillId: string;
    skillsDir: string;
}) {
    const source = readSkillSource(input.skillId);
    if (source?.source !== 'plugin') {
        return input.generatedContent;
    }

    return (
        (await fs
            .readFile(path.join(input.skillsDir, input.skillId, 'SKILL.md'), 'utf8')
            .catch((error) => {
                if (isNotFoundError(error)) {
                    return null;
                }
                throw error;
            })) ?? input.generatedContent
    );
}

function isNotFoundError(error: unknown) {
    return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
