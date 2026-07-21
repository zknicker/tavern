import { describe, expect, mock, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SidebarProvider } from '../../components/ui/sidebar.tsx';

mock.module('./sidebar-chat-list.tsx', () => ({
    AppSidebarChatList: () => React.createElement('div', { 'data-testid': 'sidebar-chat-list' }),
    buildSidebarChatGroups: () => ({
        allChats: [],
        channels: [],
        directMessages: [],
        recentChats: [],
    }),
    buildSidebarDraftChatList: () => [],
    formatSidebarActivityLabel: (label: string) => label,
    getSidebarDraftActivityLabel: () => 'Draft',
}));

mock.module('./sidebar-home-nav.tsx', () => ({
    SidebarHomeNav: () => React.createElement('div', { 'data-testid': 'sidebar-home-nav' }),
}));

mock.module('./sidebar-agent-activity-strip.tsx', () => ({
    SidebarAgentActivityStrip: () =>
        React.createElement('div', { 'data-testid': 'sidebar-agent-activity-strip' }),
}));

mock.module('./sidebar-update-menu-item.tsx', () => ({
    SidebarUpdateMenuItem: () =>
        React.createElement(
            'li',
            { 'data-testid': 'sidebar-update-menu-item' },
            'Update Available'
        ),
}));

mock.module('../settings/layout/sidebar-nav.tsx', () => ({
    SettingsSidebarNav: () => React.createElement('div', { 'data-testid': 'settings-sidebar-nav' }),
}));

const { AppSidebar } = await import('./sidebar.tsx');
mock.restore();

describe('AppSidebar', () => {
    test('renders the home nav and the update affordance in the footer', () => {
        const markup = renderToStaticMarkup(
            <SidebarProvider>
                <AppSidebar isSettingsRoute={false} onBackToApp={() => undefined} />
            </SidebarProvider>
        );

        expect(markup).toContain('sidebar-home-nav');
        expect(markup).toContain('Update Available');
        expect(markup.indexOf('sidebar-agent-activity-strip')).toBeLessThan(
            markup.indexOf('sidebar-update-menu-item')
        );
    });
});
