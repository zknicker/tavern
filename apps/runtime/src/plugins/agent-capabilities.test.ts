import type { AgentRuntimeAgent, AgentRuntimePluginId } from '@tavern/api';
import { merchbasePluginId } from '@tavern/api/plugins/merchbase';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { availableWidgetNamesForAgent } from './agent-capabilities';
import { writePluginConfig } from './store';

function agent(enabledPluginIds: AgentRuntimePluginId[]): AgentRuntimeAgent {
    return {
        enabledPluginIds,
        enabledSkillIds: [],
        id: 'agt_test',
        isAdmin: true,
        name: 'Tavern',
        primaryColor: null,
        workspaceFolder: '/tmp/tavern-agent',
    };
}

describe('availableWidgetNamesForAgent', () => {
    beforeEach(() => {
        initTestDb();
        ensureRuntimeSchema(getDb());
    });

    afterEach(() => {
        closeDb();
    });

    test('always includes core widgets and excludes plugin widgets by default', () => {
        const names = availableWidgetNamesForAgent(agent([]));

        expect(names).toContain('table');
        expect(names).toContain('bar-chart');
        expect(names).toContain('calendar-day');
        expect(names).not.toContain('merchbase-sales-chart');
    });

    test('includes a plugin widget only when the plugin is enabled and granted', () => {
        writePluginConfig({ config: {}, enabled: true, id: merchbasePluginId });

        expect(availableWidgetNamesForAgent(agent(['merchbase']))).toContain(
            'merchbase-sales-chart'
        );
        // Granted but plugin disabled → excluded.
        writePluginConfig({ config: {}, enabled: false, id: merchbasePluginId });
        expect(availableWidgetNamesForAgent(agent(['merchbase']))).not.toContain(
            'merchbase-sales-chart'
        );
        // Enabled but not granted → excluded.
        writePluginConfig({ config: {}, enabled: true, id: merchbasePluginId });
        expect(availableWidgetNamesForAgent(agent([]))).not.toContain('merchbase-sales-chart');
    });

    test('a null agent sees core widgets only', () => {
        writePluginConfig({ config: {}, enabled: true, id: merchbasePluginId });

        const names = availableWidgetNamesForAgent(null);

        expect(names).toContain('table');
        expect(names).not.toContain('merchbase-sales-chart');
    });

    test('preserves canonical widget order', () => {
        const names = availableWidgetNamesForAgent(agent([]));
        const sorted = [...names].sort();

        expect(names).not.toEqual(sorted);
        expect(names[0]).toBe('table');
    });
});
