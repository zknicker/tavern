import type {
    AgentRuntimeIntegration,
    AgentRuntimeIntegrationId,
    AgentRuntimeSkillSummary,
    AgentRuntimeToolset,
} from '@tavern/api';

export interface SkillIntegrationRef {
    displayName: string;
    enabled: boolean;
    id: AgentRuntimeIntegrationId;
}

interface IntegrationCapabilityDefinition {
    displayName: string;
    id: AgentRuntimeIntegrationId;
    skillNames: readonly string[];
    skillRuntimeSources: readonly string[];
    tools: readonly string[];
    toolsetDescription: string;
    toolsetIds: readonly string[];
    toolsetLabel: string;
}

const integrationCapabilityDefinitions = [
    {
        displayName: 'MerchBase',
        id: 'merchbase',
        skillRuntimeSources: ['tavern-integration:merchbase'],
        skillNames: ['merchbase'],
        toolsetDescription: 'Read-only MerchBase sales, product, catalog, and design tools.',
        toolsetLabel: 'MerchBase',
        toolsetIds: ['merchbase'],
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
] satisfies IntegrationCapabilityDefinition[];

export interface IntegrationToolsetPlaceholder {
    configured: boolean;
    description: string;
    enabled: boolean;
    id: string;
    label: string;
    placeholder: true;
    tools: string[];
}

export function listMissingIntegrationToolsets(
    integrations: AgentRuntimeIntegration[],
    existingToolsetIds: Set<string>
): IntegrationToolsetPlaceholder[] {
    return integrationCapabilityDefinitions
        .filter((definition) => !definition.toolsetIds.some((id) => existingToolsetIds.has(id)))
        .map((definition) => {
            const integration = buildIntegrationRef(definition, integrations);
            return {
                configured: false,
                description: definition.toolsetDescription,
                enabled: integration.enabled,
                id: definition.toolsetIds[0] ?? definition.id,
                label: definition.toolsetLabel,
                placeholder: true,
                tools: [...definition.tools],
            };
        });
}

export function resolveSkillIntegration(
    skill: Pick<AgentRuntimeSkillSummary, 'id' | 'name' | 'runtimeSource'>,
    integrations: AgentRuntimeIntegration[]
): SkillIntegrationRef | null {
    const definition = integrationCapabilityDefinitions.find(
        (candidate) =>
            Boolean(skill.runtimeSource) &&
            candidate.skillRuntimeSources.includes(skill.runtimeSource ?? '') &&
            (candidate.skillNames.includes(skill.name) || candidate.skillNames.includes(skill.id))
    );
    return definition ? buildIntegrationRef(definition, integrations) : null;
}

export function resolveToolsetIntegration(
    toolset: Pick<AgentRuntimeToolset, 'id' | 'name'>,
    integrations: AgentRuntimeIntegration[]
): SkillIntegrationRef | null {
    const definition = integrationCapabilityDefinitions.find(
        (candidate) =>
            candidate.toolsetIds.includes(toolset.id) || candidate.toolsetIds.includes(toolset.name)
    );
    return definition ? buildIntegrationRef(definition, integrations) : null;
}

export function rejectIntegrationSkillEnablement(
    skill: string | Pick<AgentRuntimeSkillSummary, 'id' | 'name' | 'runtimeSource'>
) {
    const definition =
        typeof skill === 'string'
            ? integrationCapabilityDefinitions.find((candidate) =>
                  candidate.skillNames.includes(skill)
              )
            : integrationCapabilityDefinitions.find(
                  (candidate) =>
                      Boolean(skill.runtimeSource) &&
                      candidate.skillRuntimeSources.includes(skill.runtimeSource ?? '') &&
                      (candidate.skillNames.includes(skill.name) ||
                          candidate.skillNames.includes(skill.id))
              );
    if (definition) {
        throw new Error(
            `${definition.displayName} skill enablement is managed from Settings -> Integrations.`
        );
    }
}

export function rejectIntegrationToolsetEnablement(toolsetId: string) {
    const definition = integrationCapabilityDefinitions.find((candidate) =>
        candidate.toolsetIds.includes(toolsetId)
    );
    if (definition) {
        throw new Error(
            `${definition.displayName} toolset enablement is managed from Settings -> Integrations.`
        );
    }
}

function buildIntegrationRef(
    definition: IntegrationCapabilityDefinition,
    integrations: AgentRuntimeIntegration[]
): SkillIntegrationRef {
    const integration = integrations.find((candidate) => candidate.id === definition.id);
    return {
        displayName: integration?.displayName ?? definition.displayName,
        enabled: integration?.enabled ?? false,
        id: definition.id,
    };
}
