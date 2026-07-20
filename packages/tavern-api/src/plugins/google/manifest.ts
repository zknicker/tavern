import type { AgentRuntimeCapabilityHealthId } from '../../runtime/contracts.ts';
import { tavernPluginManifestSchema } from '../contracts.ts';

export const googlePluginId = 'google' as const;

export const googleCalendarPluginHealthCapabilityId =
    'plugin.google.calendar' satisfies AgentRuntimeCapabilityHealthId;

export const googleCalendarEventsScope = 'https://www.googleapis.com/auth/calendar.events' as const;

export const googlePluginManifest = tavernPluginManifestSchema.parse({
    auth: {
        baseScopes: ['openid', 'email'],
        kind: 'oauth2',
        pkce: true,
        provider: 'google',
        redirect: 'loopback',
    },
    description: 'Read Google Workspace data through Tavern-managed Google services.',
    displayName: 'Google',
    healthCapabilities: [],
    id: googlePluginId,
    secrets: [{ name: 'oauth' }],
    services: [
        {
            defaultEnabled: true,
            description: 'Read and create Google Calendar events.',
            displayName: 'Google Calendar',
            healthCapabilities: [googleCalendarPluginHealthCapabilityId],
            id: 'calendar',
            scopes: [googleCalendarEventsScope],
            skills: [{ name: 'google-calendar', runtimeSource: 'tavern-plugin:google' }],
            toolGroups: [
                {
                    description: 'Google Calendar event tools.',
                    id: 'google-calendar',
                    label: 'Google Calendar',
                    tools: [
                        'google_calendar_events_list',
                        'google_calendar_events_search',
                        'google_calendar_event_create',
                    ],
                },
            ],
        },
    ],
    settings: [],
    version: '1.0.0',
});
