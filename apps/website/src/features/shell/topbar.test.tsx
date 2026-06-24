import { describe, expect, mock, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SidebarProvider } from '../../components/ui/sidebar.tsx';

mock.module('../../components/desktop-update-indicator.tsx', () => ({
    DesktopUpdateIndicator: () =>
        React.createElement('span', { 'data-testid': 'desktop-update-indicator' }),
}));

const { AppSidebarTopbar } = await import('./topbar.tsx');

describe('AppSidebarTopbar', () => {
    test('renders the sidebar trigger without the desktop update indicator', () => {
        const markup = renderToStaticMarkup(
            <SidebarProvider>
                <AppSidebarTopbar isExpanded={true} />
            </SidebarProvider>
        );

        expect(markup).not.toContain('data-testid="desktop-update-indicator"');
        expect(markup).toContain('data-slot="sidebar-trigger"');
    });

    test('does not render sidebar topbar controls while collapsed', () => {
        const markup = renderToStaticMarkup(
            <SidebarProvider>
                <AppSidebarTopbar isExpanded={false} />
            </SidebarProvider>
        );

        expect(markup).not.toContain('data-testid="desktop-update-indicator"');
        expect(markup).not.toContain('data-slot="sidebar-trigger"');
    });
});
