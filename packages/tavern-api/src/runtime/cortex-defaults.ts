import type { CortexSchemaDefinition } from './contracts.js';

export const defaultCortexPageTypes = [
    'person',
    'company',
    'project',
    'product',
    'brand',
    'campaign',
    'customer-segment',
    'supplier',
    'platform',
    'tool',
    'asset',
    'decision',
    'task',
    'metric',
    'idea',
    'note',
] as const;

export const defaultCortexLinkTypes = [
    'mentions',
    'related_to',
    'depends_on',
    'blocks',
    'supports',
    'contradicts',
    'same_as',
    'uses',
    'owns',
    'targets',
    'tracks',
    'source',
] as const;

export const defaultCortexFrontmatterMappings = [
    { fields: ['mentions'], linkType: 'mentions' },
    { fields: ['platforms', 'tools', 'apis', 'models', 'assets'], linkType: 'uses' },
    { fields: ['uses'], linkType: 'uses' },
    { fields: ['supplier', 'suppliers', 'depends_on'], linkType: 'depends_on' },
    { fields: ['blocked_by'], linkType: 'blocks' },
    { fields: ['blocks'], linkType: 'blocks' },
    { fields: ['brand'], linkType: 'owns' },
    { fields: ['owns'], linkType: 'owns' },
    { fields: ['customer_segments', 'audience', 'products'], linkType: 'targets' },
    { fields: ['targets'], linkType: 'targets' },
    { fields: ['metrics'], linkType: 'tracks' },
    { fields: ['tracks'], linkType: 'tracks' },
    { fields: ['related', 'see_also'], linkType: 'related_to' },
    { fields: ['related_to'], linkType: 'related_to' },
    { fields: ['supports'], linkType: 'supports' },
    { fields: ['contradicts'], linkType: 'contradicts' },
    { fields: ['same_as'], linkType: 'same_as' },
    { fields: ['source', 'sources'], linkType: 'source' },
] as const;

export const defaultCortexSchema = {
    frontmatterMappings: defaultCortexFrontmatterMappings.map((mapping) => ({
        fields: [...mapping.fields],
        linkType: mapping.linkType,
    })),
    linkTypes: defaultCortexLinkTypes.map((name) => ({ name })),
    name: 'cortex-base',
    pageTypes: [...defaultCortexPageTypes],
    version: 1,
} satisfies CortexSchemaDefinition;
