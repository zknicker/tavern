import type {
    AgentRuntimePlugin,
    AgentRuntimePluginId,
    AgentRuntimeSkillSummary,
    AgentRuntimeTool,
} from '@tavern/api';

export interface SkillPluginRef {
    displayName: string;
    enabled: boolean;
    id: AgentRuntimePluginId;
}

interface PluginCapabilityDefinition {
    displayName: string;
    id: AgentRuntimePluginId;
    skillNames: readonly string[];
    skillRuntimeSources: readonly string[];
    toolDescription: string;
    toolIds: readonly string[];
    toolLabel: string;
    tools: readonly string[];
}

const pluginCapabilityDefinitions = [
    {
        displayName: 'MerchBase',
        id: 'merchbase',
        skillRuntimeSources: ['tavern-plugin:merchbase'],
        skillNames: ['merchbase'],
        toolDescription: 'Read-only MerchBase sales, product, catalog, and design tools.',
        toolLabel: 'MerchBase',
        toolIds: ['merchbase'],
        tools: [
            'merchbase_status',
            'merchbase_sales_summary',
            'merchbase_sales_records',
            'merchbase_sales_series',
            'merchbase_sales_breakdown',
            'merchbase_products_list',
            'merchbase_products_search',
            'merchbase_products_get',
            'merchbase_products_metadata',
            'merchbase_product_catalog',
            'merchbase_product_catalog_options',
            'merchbase_product_catalog_product',
            'merchbase_designs_list',
            'merchbase_designs_get',
            'merchbase_design_facets_get',
        ],
    },
] satisfies PluginCapabilityDefinition[];

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
        .filter((definition) => !definition.toolIds.some((id) => existingToolIds.has(id)))
        .map((definition) => {
            const plugin = buildPluginRef(definition, plugins);
            return {
                configured: false,
                description: definition.toolDescription,
                enabled: plugin.enabled,
                id: definition.toolIds[0] ?? definition.id,
                label: definition.toolLabel,
                placeholder: true,
                tools: [...definition.tools],
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
            candidate.skillRuntimeSources.includes(skill.runtimeSource ?? '') &&
            (candidate.skillNames.includes(skill.name) || candidate.skillNames.includes(skill.id))
    );
    return definition ? buildPluginRef(definition, plugins) : null;
}

export function resolveToolPlugin(
    tool: Pick<AgentRuntimeTool, 'id' | 'name'>,
    plugins: AgentRuntimePlugin[]
): SkillPluginRef | null {
    const definition = pluginCapabilityDefinitions.find(
        (candidate) => candidate.toolIds.includes(tool.id) || candidate.toolIds.includes(tool.name)
    );
    return definition ? buildPluginRef(definition, plugins) : null;
}

export function rejectPluginSkillEnablement(
    skill: string | Pick<AgentRuntimeSkillSummary, 'id' | 'name' | 'runtimeSource'>
) {
    const definition =
        typeof skill === 'string'
            ? pluginCapabilityDefinitions.find((candidate) => candidate.skillNames.includes(skill))
            : pluginCapabilityDefinitions.find(
                  (candidate) =>
                      Boolean(skill.runtimeSource) &&
                      candidate.skillRuntimeSources.includes(skill.runtimeSource ?? '') &&
                      (candidate.skillNames.includes(skill.name) ||
                          candidate.skillNames.includes(skill.id))
              );
    if (definition) {
        throw new Error(
            `${definition.displayName} skill enablement is managed from Settings -> Plugins.`
        );
    }
}

export function rejectPluginToolEnablement(toolId: string) {
    const definition = pluginCapabilityDefinitions.find((candidate) =>
        candidate.toolIds.includes(toolId)
    );
    if (definition) {
        throw new Error(
            `${definition.displayName} tool enablement is managed from Settings -> Plugins.`
        );
    }
}

function buildPluginRef(
    definition: PluginCapabilityDefinition,
    plugins: AgentRuntimePlugin[]
): SkillPluginRef {
    const plugin = plugins.find((candidate) => candidate.id === definition.id);
    return {
        displayName: plugin?.displayName ?? definition.displayName,
        enabled: plugin?.enabled ?? false,
        id: definition.id,
    };
}
