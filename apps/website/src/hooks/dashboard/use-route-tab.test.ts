import { describe, expect, test } from 'bun:test';
import { getRouteTab, routeTabs } from './use-route-tab.ts';

describe('dashboard route tab', () => {
    test('labels the cron dashboard tab as Tasks', () => {
        expect(routeTabs.find((tab) => tab.id === 'cron')?.label).toBe('Tasks');
    });

    test('exposes Workspace as a dashboard tab', () => {
        expect(routeTabs.find((tab) => tab.id === 'workspace')).toEqual({
            id: 'workspace',
            label: 'Workspace',
            path: '/dashboard/workspace',
        });
    });

    test('returns the matching dashboard tab for primary routes', () => {
        expect(getRouteTab('/dashboard/overview')).toBe('overview');
        expect(getRouteTab('/dashboard/workspace')).toBe('workspace');
        expect(getRouteTab('/dashboard/memory')).toBe('memory');
        expect(getRouteTab('/dashboard/vault')).toBe('memory');
    });

    test('returns null when no dashboard tab is active', () => {
        expect(getRouteTab('/dashboard/agent')).toBeNull();
        expect(getRouteTab('/dashboard/stats')).toBeNull();
        expect(getRouteTab('/dashboard/skills')).toBeNull();
        expect(getRouteTab('/dashboard/settings')).toBeNull();
        expect(getRouteTab('/dashboard/settings/theme')).toBeNull();
    });
});
