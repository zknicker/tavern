import { describe, expect, test } from 'bun:test';
import { getRouteTab, routeTabs } from './use-route-tab.ts';

describe('app route tab', () => {
    test('labels the task tab as Tasks', () => {
        expect(routeTabs.find((tab) => tab.id === 'tasks')?.label).toBe('Tasks');
    });

    test('labels the automations tab as Automations', () => {
        expect(routeTabs.find((tab) => tab.id === 'automations')?.label).toBe('Automations');
    });

    test('exposes Workspace as an app tab', () => {
        expect(routeTabs.find((tab) => tab.id === 'workspace')).toEqual({
            id: 'workspace',
            label: 'Workspace',
            path: '/workspace',
        });
    });

    test('returns the matching app tab for primary routes', () => {
        expect(getRouteTab('/overview')).toBe('overview');
        expect(getRouteTab('/tasks')).toBe('tasks');
        expect(getRouteTab('/automations')).toBe('automations');
        expect(getRouteTab('/workspace')).toBe('workspace');
        expect(getRouteTab('/wiki')).toBe('wiki');
    });

    test('keeps dashboard tab detection during redirects', () => {
        expect(getRouteTab('/dashboard/overview')).toBe('overview');
        expect(getRouteTab('/dashboard/cron')).toBe('automations');
        expect(getRouteTab('/dashboard/workspace')).toBe('workspace');
        expect(getRouteTab('/dashboard/wiki')).toBe('wiki');
    });

    test('returns null when no app tab is active', () => {
        expect(getRouteTab('/agent')).toBeNull();
        expect(getRouteTab('/stats')).toBeNull();
        expect(getRouteTab('/skills')).toBeNull();
        expect(getRouteTab('/settings')).toBeNull();
        expect(getRouteTab('/settings/theme')).toBeNull();
    });
});
