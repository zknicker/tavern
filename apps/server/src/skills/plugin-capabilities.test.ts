import { describe, expect, test } from 'bun:test';
import {
    listMissingPluginTools,
    rejectPluginSkillEnablement,
    rejectPluginToolEnablement,
    resolveSkillPlugin,
    resolveToolPlugin,
} from './plugin-capabilities.ts';

describe('Plugin capability ownership', () => {
    const plugins = [
        {
            config: {},
            description: 'Analyze Amazon Merch sales and product data from MerchBase.',
            displayName: 'MerchBase',
            enabled: true,
            id: 'merchbase' as const,
            secrets: [],
            services: [
                {
                    description: 'Read-only MerchBase sales, product, catalog, and design tools.',
                    displayName: 'MerchBase',
                    enabled: true,
                    healthCapabilities: ['plugin.merchbase' as const],
                    id: 'merchbase',
                    scopes: [],
                },
            ],
            updatedAt: null,
        },
        {
            config: {},
            description: 'Read Google Workspace data through Tavern-managed Google services.',
            displayName: 'Google',
            enabled: true,
            id: 'google' as const,
            secrets: [],
            services: [
                {
                    description: 'Read and create Google Calendar events.',
                    displayName: 'Google Calendar',
                    enabled: true,
                    healthCapabilities: ['plugin.google.calendar' as const],
                    id: 'calendar',
                    scopes: ['https://www.googleapis.com/auth/calendar.events'],
                },
            ],
            updatedAt: null,
        },
    ];

    test('marks Plugin-owned skills and tools', () => {
        expect(
            resolveSkillPlugin(
                {
                    id: 'merchbase',
                    name: 'merchbase',
                    runtimeSource: 'tavern-plugin:merchbase',
                },
                plugins
            )
        ).toEqual({
            displayName: 'MerchBase',
            enabled: true,
            id: 'merchbase',
        });
        expect(resolveToolPlugin({ id: 'merchbase', name: 'MerchBase' }, plugins)).toEqual({
            displayName: 'MerchBase',
            enabled: true,
            id: 'merchbase',
        });
        expect(
            resolveToolPlugin({ id: 'merchbase_sales_series', name: 'Sales series' }, plugins)
        ).toEqual({
            displayName: 'MerchBase',
            enabled: true,
            id: 'merchbase',
        });
        expect(
            resolveSkillPlugin(
                {
                    id: 'google-calendar',
                    name: 'google-calendar',
                    runtimeSource: 'tavern-plugin:google',
                },
                plugins
            )
        ).toEqual({
            displayName: 'Google',
            enabled: true,
            id: 'google',
        });
        expect(
            resolveToolPlugin(
                { id: 'google_calendar_events_list', name: 'Google Calendar events' },
                plugins
            )
        ).toEqual({
            displayName: 'Google',
            enabled: true,
            id: 'google',
        });
    });

    test('does not treat user-owned merchbase skills as Plugin-owned', () => {
        expect(resolveSkillPlugin({ id: 'merchbase', name: 'merchbase' }, plugins)).toBeNull();
    });

    test('rejects direct enablement for Plugin-owned capabilities', () => {
        expect(() => rejectPluginSkillEnablement('merchbase')).toThrow(
            /managed from Settings -> Plugins/
        );
        expect(() => rejectPluginToolEnablement('merchbase')).toThrow(
            /managed from Settings -> Plugins/
        );
        expect(() => rejectPluginToolEnablement('merchbase_sales_series')).toThrow(
            /managed from Settings -> Plugins/
        );
    });

    test('provides a placeholder when a Plugin tool is not reported yet', () => {
        expect(listMissingPluginTools(plugins, new Set())).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    enabled: true,
                    id: 'merchbase',
                    label: 'MerchBase',
                    placeholder: true,
                }),
                expect.objectContaining({
                    enabled: true,
                    id: 'google-calendar',
                    label: 'Google Calendar',
                    placeholder: true,
                }),
            ])
        );
        expect(listMissingPluginTools(plugins, new Set(['merchbase', 'google-calendar']))).toEqual(
            []
        );
    });
});
