import { describe, expect, test } from 'bun:test';
import {
    listMissingIntegrationToolsets,
    rejectIntegrationSkillEnablement,
    rejectIntegrationToolsetEnablement,
    resolveSkillIntegration,
    resolveToolsetIntegration,
} from './integration-capabilities.ts';

describe('Integration capability ownership', () => {
    const integrations = [
        {
            config: {},
            displayName: 'MerchBase',
            enabled: true,
            id: 'merchbase' as const,
            secrets: [],
            updatedAt: null,
        },
    ];

    test('marks merchbase skill and toolset as Integration-owned', () => {
        expect(
            resolveSkillIntegration(
                {
                    id: 'merchbase',
                    name: 'merchbase',
                    runtimeSource: 'tavern-integration:merchbase',
                },
                integrations
            )
        ).toEqual({
            displayName: 'MerchBase',
            enabled: true,
            id: 'merchbase',
        });
        expect(
            resolveToolsetIntegration({ id: 'merchbase', name: 'MerchBase' }, integrations)
        ).toEqual({
            displayName: 'MerchBase',
            enabled: true,
            id: 'merchbase',
        });
    });

    test('does not treat user-owned merchbase skills as Integration-owned', () => {
        expect(
            resolveSkillIntegration({ id: 'merchbase', name: 'merchbase' }, integrations)
        ).toBeNull();
    });

    test('rejects direct enablement for Integration-owned capabilities', () => {
        expect(() => rejectIntegrationSkillEnablement('merchbase')).toThrow(
            /managed from Settings -> Integrations/
        );
        expect(() => rejectIntegrationToolsetEnablement('merchbase')).toThrow(
            /managed from Settings -> Integrations/
        );
    });

    test('provides a placeholder when an Integration toolset is not reported yet', () => {
        expect(listMissingIntegrationToolsets(integrations, new Set())).toMatchObject([
            {
                enabled: true,
                id: 'merchbase',
                label: 'MerchBase',
                placeholder: true,
            },
        ]);
        expect(listMissingIntegrationToolsets(integrations, new Set(['merchbase']))).toEqual([]);
    });
});
