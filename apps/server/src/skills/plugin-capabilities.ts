import type {
    AgentRuntimePlugin,
    AgentRuntimePluginId,
    AgentRuntimeSkillSummary,
    AgentRuntimeTool,
} from '@tavern/api';
import { type TavernPluginManifest, tavernPluginManifests } from '@tavern/api/plugins';

export interface SkillPluginRef {
    displayName: string;
    enabled: boolean;
    id: AgentRuntimePluginId;
}

const pluginCapabilityDefinitions = tavernPluginManifests;

export interface PluginToolPlaceholder {
    configured: boolean;
    description: string;
    enabled: boolean;
    id: string;
    label: string;
    placeholder: true;
    tools: string[];
}

export function listMissingPluginTools(
    plugins: AgentRuntimePlugin[],
    existingToolIds: Set<string>
): PluginToolPlaceholder[] {
    return pluginCapabilityDefinitions
        .flatMap((definition) =>
            definition.toolGroups.map((toolGroup) => ({ definition, toolGroup }))
        )
        .filter(({ toolGroup }) => !existingToolIds.has(toolGroup.id))
        .map(({ definition, toolGroup }) => {
            const plugin = buildPluginRef(definition, plugins);
            return {
                configured: false,
                description: toolGroup.description,
                enabled: plugin.enabled,
                id: toolGroup.id,
                label: toolGroup.label,
                placeholder: true,
                tools: [...toolGroup.tools],
            };
        });
}

export function resolveSkillPlugin(
    skill: Pick<AgentRuntimeSkillSummary, 'id' | 'name' | 'runtimeSource'>,
    plugins: AgentRuntimePlugin[]
): SkillPluginRef | null {
    const definition = pluginCapabilityDefinitions.find(
        (candidate) =>
            Boolean(skill.runtimeSource) &&
            candidate.skills.some(
                (pluginSkill) =>
                    pluginSkill.runtimeSource === skill.runtimeSource &&
                    (pluginSkill.name === skill.name || pluginSkill.name === skill.id)
            )
    );
    return definition ? buildPluginRef(definition, plugins) : null;
}

export function resolveToolPlugin(
    tool: Pick<AgentRuntimeTool, 'id' | 'name'>,
    plugins: AgentRuntimePlugin[]
): SkillPluginRef | null {
    const definition = pluginCapabilityDefinitions.find((candidate) =>
        candidate.toolGroups.some(
            (toolGroup) =>
                toolGroup.id === tool.id ||
                toolGroup.id === tool.name ||
                toolGroup.tools.includes(tool.id) ||
                toolGroup.tools.includes(tool.name)
        )
    );
    return definition ? buildPluginRef(definition, plugins) : null;
}

export function rejectPluginSkillEnablement(
    skill: string | Pick<AgentRuntimeSkillSummary, 'id' | 'name' | 'runtimeSource'>
) {
    const definition =
        typeof skill === 'string'
            ? pluginCapabilityDefinitions.find((candidate) =>
                  candidate.skills.some((pluginSkill) => pluginSkill.name === skill)
              )
            : pluginCapabilityDefinitions.find(
                  (candidate) =>
                      Boolean(skill.runtimeSource) &&
                      candidate.skills.some(
                          (pluginSkill) =>
                              pluginSkill.runtimeSource === skill.runtimeSource &&
                              (pluginSkill.name === skill.name || pluginSkill.name === skill.id)
                      )
              );
    if (definition) {
        throw new Error(
            `${definition.displayName} skill enablement is managed from Settings -> Plugins.`
        );
    }
}

export function rejectPluginToolEnablement(toolId: string) {
    const definition = pluginCapabilityDefinitions.find((candidate) =>
        candidate.toolGroups.some(
            (toolGroup) => toolGroup.id === toolId || toolGroup.tools.includes(toolId)
        )
    );
    if (definition) {
        throw new Error(
            `${definition.displayName} tool enablement is managed from Settings -> Plugins.`
        );
    }
}

function buildPluginRef(
    definition: TavernPluginManifest,
    plugins: AgentRuntimePlugin[]
): SkillPluginRef {
    const plugin = plugins.find((candidate) => candidate.id === definition.id);
    return {
        displayName: plugin?.displayName ?? definition.displayName,
        enabled: plugin?.enabled ?? false,
        id: definition.id,
    };
}
