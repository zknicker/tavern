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

mock.module('./sidebar-nav.tsx', () => ({
    AppSidebarNav: () => React.createElement('div', { 'data-testid': 'sidebar-nav' }),
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
    test('renders update affordance above Settings in the footer', () => {
        const markup = renderToStaticMarkup(
            <SidebarProvider>
                <AppSidebar
                    isSettingsRoute={false}
                    onBackToApp={() => undefined}
                    onNavigateToSettings={() => undefined}
                />
            </SidebarProvider>
        );

        expect(markup.indexOf('Update Available')).toBeGreaterThanOrEqual(0);
        expect(markup.indexOf('Update Available')).toBeLessThan(markup.indexOf('Settings'));
    });
});
