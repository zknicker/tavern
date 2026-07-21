import type { AgentRuntimeCapabilityHealthId } from '../../runtime/contracts.ts';
import { tavernPluginManifestSchema } from '../contracts.ts';

export const browserPluginId = 'browser' as const;

export const browserPluginHealthCapabilityId =
    'plugin.browser' satisfies AgentRuntimeCapabilityHealthId;

export const browserPluginManifest = tavernPluginManifestSchema.parse({
    description: 'Control a visible, managed Chrome browser with a durable signed-in profile.',
    displayName: 'Browser',
    healthCapabilities: [],
    id: browserPluginId,
    secrets: [],
    services: [
        {
            defaultEnabled: true,
            description:
                'Navigate, inspect, and interact with websites through the managed Chrome browser.',
            displayName: 'Browser',
            healthCapabilities: [browserPluginHealthCapabilityId],
            id: 'browser',
            scopes: [],
            skills: [{ name: 'browser', runtimeSource: 'tavern-plugin:browser' }],
            toolGroups: [
                {
                    description:
                        'Browser automation: navigation, snapshots, interaction, and screenshots in the managed Chrome browser.',
                    id: 'browser',
                    label: 'Browser',
                    readOnly: false,
                    tools: ['browser'],
                },
            ],
        },
    ],
    settings: ['profileName'],
    version: '1.0.0',
});
