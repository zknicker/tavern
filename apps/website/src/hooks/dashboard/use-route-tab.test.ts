import { describe, expect, test } from 'bun:test';
import { getRouteTab, routeTabs } from './use-route-tab.ts';

describe('dashboard route tab', () => {
    test('labels the cron dashboard tab as Automations', () => {
        expect(routeTabs.find((tab) => tab.id === 'cron')?.label).toBe('Automations');
    });

    test('returns the matching dashboard tab for primary routes', () => {
        expect(getRouteTab('/dashboard/overview')).toBe('overview');
        expect(getRouteTab('/dashboard/stats')).toBe('stats');
        expect(getRouteTab('/dashboard/cortex')).toBe('cortex');
    });

    test('returns null when no dashboard tab is active', () => {
        expect(getRouteTab('/dashboard/agent')).toBeNull();
        expect(getRouteTab('/dashboard/skills')).toBeNull();
        expect(getRouteTab('/dashboard/settings')).toBeNull();
        expect(getRouteTab('/dashboard/settings/theme')).toBeNull();
    });
});
