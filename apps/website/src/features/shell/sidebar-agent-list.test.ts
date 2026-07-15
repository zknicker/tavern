import { describe, expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { SidebarProvider } from '../../components/ui/sidebar.tsx';
import type { AgentRailItem } from '../../hooks/agents/use-agent-rail.ts';
import { AppSidebarAgentList, resolveSidebarAgentActive } from './sidebar-agent-list.tsx';

function createAgentRailItem(overrides: Partial<AgentRailItem> = {}): AgentRailItem {
    return {
        id: 'agent-1',
        isThinking: false,
        name: 'Alpha Agent',
        ...overrides,
    };
}

describe('resolveSidebarAgentActive', () => {
    test('marks sidebar agent rows active while the agent is busy (presence)', () => {
        expect(resolveSidebarAgentActive(createAgentRailItem({ isThinking: true }))).toBe(true);
    });

    test('keeps idle agent rail items idle', () => {
        expect(resolveSidebarAgentActive(createAgentRailItem())).toBe(false);
    });
});

describe('AppSidebarAgentList', () => {
    test('does not mark an agent active for first-class chat detail routes', () => {
        const markup = renderToStaticMarkup(
            React.createElement(
                MemoryRouter,
                { initialEntries: ['/chats/chat-1'] },
                React.createElement(
                    SidebarProvider,
                    null,
                    React.createElement(AppSidebarAgentList, {
                        sidebarAgents: [createAgentRailItem({ name: 'Claw' })],
                    })
                )
            )
        );

        const activeFillCount = markup.match(/data-active=""/g)?.length ?? 0;

        assert.equal(activeFillCount, 0);
        assert.match(markup, /Claw/);
        assert.doesNotMatch(markup, /Chats/);
        assert.doesNotMatch(markup, /Home/);
    });

    test('does not mark the retired agent root route as active', () => {
        const markup = renderToStaticMarkup(
            React.createElement(
                MemoryRouter,
                { initialEntries: ['/agent'] },
                React.createElement(
                    SidebarProvider,
                    null,
                    React.createElement(AppSidebarAgentList, {
                        sidebarAgents: [createAgentRailItem({ name: 'Claw' })],
                    })
                )
            )
        );

        const activeFillCount = markup.match(/data-active=""/g)?.length ?? 0;

        assert.equal(activeFillCount, 0);
        assert.match(markup, /Claw/);
        assert.doesNotMatch(markup, /Chats/);
        assert.doesNotMatch(markup, /Home/);
        assert.doesNotMatch(markup, /Config/);
    });
});
