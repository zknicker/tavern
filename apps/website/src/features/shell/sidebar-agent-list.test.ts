import { describe, expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { SidebarProvider } from '../../components/ui/sidebar.tsx';
import type { AgentRailItem } from '../../hooks/agents/use-agent-rail.ts';
import { AppSidebarAgentList, resolveSidebarAgentAvatarActive } from './sidebar-agent-list.tsx';

function createAgentRailItem(overrides: Partial<AgentRailItem> = {}): AgentRailItem {
    return {
        avatar: 'A',
        id: 'agent-1',
        isThinking: false,
        name: 'Alpha Agent',
        primaryColor: '#000000',
        ...overrides,
    };
}

describe('resolveSidebarAgentAvatarActive', () => {
    test('keeps sidebar avatars idle when an agent rail item is marked thinking', () => {
        expect(resolveSidebarAgentAvatarActive(createAgentRailItem({ isThinking: true }))).toBe(
            false
        );
    });

    test('keeps idle agent rail items idle', () => {
        expect(resolveSidebarAgentAvatarActive(createAgentRailItem())).toBe(false);
    });
});

describe('AppSidebarAgentList', () => {
    test('does not mark an agent active for first-class chat detail routes', () => {
        const markup = renderToStaticMarkup(
            React.createElement(
                MemoryRouter,
                { initialEntries: ['/dashboard/chats/chat-1'] },
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

    test('uses the agent row as the active home link on the agent root route', () => {
        const markup = renderToStaticMarkup(
            React.createElement(
                MemoryRouter,
                { initialEntries: ['/dashboard/agent'] },
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

        assert.equal(activeFillCount, 1);
        assert.match(markup, /Claw/);
        assert.doesNotMatch(markup, /Chats/);
        assert.doesNotMatch(markup, /Home/);
        assert.doesNotMatch(markup, /Config/);
    });
});
