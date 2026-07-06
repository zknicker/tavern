import type { ToolSet } from '@ai-sdk/provider-utils';
import type {
    AgentRuntimeAgent,
    AgentRuntimeGoogleCalendarEventCreateInput,
    AgentRuntimeGoogleCalendarEventsListInput,
} from '@tavern/api';
import { googlePluginId } from '@tavern/api/plugins/google';
import { tool } from 'ai';
import * as z from 'zod';
import {
    createGoogleCalendarEvent,
    getGoogleSettings,
    queryGoogleCalendarEvents,
} from './google.ts';

const googleCalendarToolInputSchema = z.object({
    calendarId: z.string().trim().min(1).optional(),
    maxResults: z.number().int().min(1).max(50).optional(),
    query: z.string().trim().min(1).max(512).optional(),
    timeMax: z.string().datetime().optional(),
    timeMin: z.string().datetime().optional(),
    timeZone: z.string().trim().min(1).max(128).optional(),
});

const googleCalendarEventCreateInputSchema = z.object({
    calendarId: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).max(8192).optional(),
    endDateTime: z.string().datetime(),
    location: z.string().trim().min(1).max(1024).optional(),
    startDateTime: z.string().datetime(),
    summary: z.string().trim().min(1).max(1024),
    timeZone: z.string().trim().min(1).max(128).optional(),
});

export function createGoogleToolsForAgent(agent: AgentRuntimeAgent): ToolSet {
    const settings = getGoogleSettings();
    if (
        !(
            (agent.enabledPluginIds ?? []).includes(googlePluginId) &&
            settings.enabled &&
            settings.calendarEnabled &&
            settings.connected &&
            settings.missingCalendarScopes.length === 0
        )
    ) {
        return {};
    }

    return {
        google_calendar_events_list: tool({
            description: 'List Google Calendar events in a time window.',
            inputSchema: googleCalendarToolInputSchema.omit({ query: true }),
            execute: async (input) => await executeCalendarTool(input),
        }),
        google_calendar_events_search: tool({
            description: 'Search Google Calendar events by text.',
            inputSchema: googleCalendarToolInputSchema.extend({
                query: z.string().trim().min(1).max(512),
            }),
            execute: async (input) => await executeCalendarTool(input),
        }),
        google_calendar_event_create: tool({
            description:
                'Create a Google Calendar event after the user has confirmed the event details.',
            inputSchema: googleCalendarEventCreateInputSchema,
            execute: async (input) => await executeCalendarCreateTool(input),
        }),
    };
}

async function executeCalendarTool(input: AgentRuntimeGoogleCalendarEventsListInput) {
    try {
        return await queryGoogleCalendarEvents(input);
    } catch (error) {
        return {
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

async function executeCalendarCreateTool(input: AgentRuntimeGoogleCalendarEventCreateInput) {
    try {
        return await createGoogleCalendarEvent(input);
    } catch (error) {
        return {
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
