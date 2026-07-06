import { describe, expect, test } from 'bun:test';
import { richResponseMerchBaseSalesChartComponentType } from '../rich-responses/merchbase/contracts.ts';
import {
    googleCalendarEventsScope,
    googleCalendarPluginHealthCapabilityId,
    googlePluginId,
    googlePluginManifest,
    merchbasePluginHealthCapabilityId,
    merchbasePluginId,
    merchbasePluginManifest,
    tavernPluginManifests,
} from './index.ts';

describe('Plugin manifests', () => {
    test('declares MerchBase service inventory', () => {
        expect(tavernPluginManifests).toHaveLength(2);
        expect(merchbasePluginManifest).toMatchObject({
            description: 'Analyze Amazon Merch sales and product data from MerchBase.',
            displayName: 'MerchBase',
            healthCapabilities: [],
            id: merchbasePluginId,
            richResponseComponents: [{ type: richResponseMerchBaseSalesChartComponentType }],
            secrets: [{ name: 'apiKey' }],
            settings: ['baseUrl', 'defaultAccount', 'defaultMarketplace'],
            version: '1.0.0',
        });
        expect(merchbasePluginManifest.services[0]).toMatchObject({
            defaultEnabled: true,
            displayName: 'MerchBase',
            healthCapabilities: [merchbasePluginHealthCapabilityId],
            id: 'merchbase',
            skills: [{ name: 'merchbase', runtimeSource: 'tavern-plugin:merchbase' }],
        });
        expect(merchbasePluginManifest.services[0]?.toolGroups[0]).toMatchObject({
            id: 'merchbase',
            label: 'MerchBase',
        });
        expect(merchbasePluginManifest.services[0]?.toolGroups[0]?.tools).toContain(
            'merchbase_sales_series'
        );
    });

    test('declares Google Calendar as the first Google service', () => {
        expect(googlePluginManifest).toMatchObject({
            auth: {
                baseScopes: ['openid', 'email'],
                kind: 'oauth2',
                pkce: true,
                provider: 'google',
                redirect: 'loopback',
            },
            displayName: 'Google',
            healthCapabilities: [],
            id: googlePluginId,
            secrets: [{ name: 'oauth' }],
            settings: [],
            version: '1.0.0',
        });
        expect(googlePluginManifest.services[0]).toMatchObject({
            defaultEnabled: true,
            displayName: 'Google Calendar',
            healthCapabilities: [googleCalendarPluginHealthCapabilityId],
            id: 'calendar',
            scopes: [googleCalendarEventsScope],
            skills: [{ name: 'google-calendar', runtimeSource: 'tavern-plugin:google' }],
        });
        expect(googlePluginManifest.services[0]?.toolGroups[0]).toMatchObject({
            id: 'google-calendar',
            label: 'Google Calendar',
        });
        expect(googlePluginManifest.services[0]?.toolGroups[0]?.tools).toEqual([
            'google_calendar_events_list',
            'google_calendar_events_search',
            'google_calendar_event_create',
        ]);
    });
});
