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
            displayName: 'MerchBase',
            enabled: true,
            id: 'merchbase' as const,
            secrets: [],
            updatedAt: null,
        },
    ];

    test('marks merchbase skill and tool as Plugin-owned', () => {
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
    });

    test('provides a placeholder when a Plugin tool is not reported yet', () => {
        expect(listMissingPluginTools(plugins, new Set())).toMatchObject([
            {
                enabled: true,
                id: 'merchbase',
                label: 'MerchBase',
                placeholder: true,
            },
        ]);
        expect(listMissingPluginTools(plugins, new Set(['merchbase']))).toEqual([]);
    });
});
