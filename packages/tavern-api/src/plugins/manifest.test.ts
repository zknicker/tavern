import { describe, expect, test } from 'bun:test';
import { richResponseMerchBaseSalesChartComponentType } from '../rich-responses/merchbase/contracts.ts';
import {
    merchbasePluginHealthCapabilityId,
    merchbasePluginId,
    merchbasePluginManifest,
    tavernPluginManifests,
} from './index.ts';

describe('Plugin manifests', () => {
    test('declares MerchBase inventory in one manifest', () => {
        expect(tavernPluginManifests).toHaveLength(1);
        expect(merchbasePluginManifest).toMatchObject({
            description: 'Analyze Amazon Merch sales and product data from MerchBase.',
            displayName: 'MerchBase',
            healthCapabilities: [merchbasePluginHealthCapabilityId],
            id: merchbasePluginId,
            richResponseComponents: [{ type: richResponseMerchBaseSalesChartComponentType }],
            secrets: [{ name: 'apiKey' }],
            settings: ['baseUrl', 'defaultAccount', 'defaultMarketplace'],
            skills: [{ name: 'merchbase', runtimeSource: 'tavern-plugin:merchbase' }],
            version: '1.0.0',
        });
        expect(merchbasePluginManifest.toolGroups[0]).toMatchObject({
            id: 'merchbase',
            label: 'MerchBase',
        });
        expect(merchbasePluginManifest.toolGroups[0]?.tools).toContain('merchbase_sales_series');
    });
});
