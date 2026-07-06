import { googleCalendarEventsScope } from '@tavern/api/plugins/google';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { getGoogleSettings, saveGoogleSettings } from './google';
import { createGoogleToolsForAgent } from './google-tools';
import { getPlugin, writePluginSecret } from './store';

describe('Google Plugin settings', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    test('stores Google config in Plugin tables', () => {
        const settings = saveGoogleSettings({
            calendarEnabled: true,
            enabled: true,
        });

        expect(settings).toMatchObject({
            calendarEnabled: true,
            connected: false,
            enabled: true,
        });
        expect(getPlugin('google').services[0]).toMatchObject({
            enabled: true,
            id: 'calendar',
        });
        expect(getPlugin('google').secrets).toEqual([]);
        expect(
            getDb()
                .prepare('SELECT config_json FROM runtime_plugins WHERE id = $id')
                .get({ $id: 'google' })
        ).toMatchObject({
            config_json: JSON.stringify({
                services: { calendar: { enabled: true } },
            }),
        });
    });

    test('exposes Calendar tools only after grant and OAuth connection', () => {
        saveGoogleSettings({
            calendarEnabled: true,
            enabled: true,
        });
        writePluginSecret({
            id: 'google',
            secret: {
                oauth: {
                    accessToken: 'access-token',
                    account: {
                        email: 'zach@example.com',
                        subject: 'sub_123',
                    },
                    expiresAt: new Date(Date.now() + 60_000).toISOString(),
                    grantedScopes: [googleCalendarEventsScope],
                    refreshToken: 'refresh-token',
                    tokenType: 'Bearer',
                },
            },
        });

        expect(getGoogleSettings()).toMatchObject({
            connected: true,
            connectedAccountEmail: 'zach@example.com',
            missingCalendarScopes: [],
        });
        expect(
            Object.keys(
                createGoogleToolsForAgent({
                    enabledPluginIds: ['google'],
                    enabledSkillIds: [],
                    id: 'agt_primary',
                    isAdmin: true,
                    name: 'Tavern',
                    primaryColor: null,
                    workspaceFolder: '/tmp/tavern-agent',
                })
            )
        ).toEqual([
            'google_calendar_events_list',
            'google_calendar_events_search',
            'google_calendar_event_create',
        ]);
        expect(
            createGoogleToolsForAgent({
                enabledPluginIds: [],
                enabledSkillIds: [],
                id: 'agt_primary',
                isAdmin: true,
                name: 'Tavern',
                primaryColor: null,
                workspaceFolder: '/tmp/tavern-agent',
            })
        ).toEqual({});
    });
});
