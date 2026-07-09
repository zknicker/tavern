import { describe, expect, test } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpLink } from '@trpc/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { trpc } from '../../../lib/trpc.tsx';
import { useLayoutContext } from '../../shell/use-layout-context.ts';
import { SettingsContent, SettingsLayout } from './page.tsx';

describe('SettingsLayout', () => {
    test('forwards the app layout context to settings child routes', () => {
        const queryClient = new QueryClient();
        const client = trpc.createClient({
            links: [httpLink({ url: 'http://127.0.0.1:1/trpc' })],
        });
        const markup = renderToStaticMarkup(
            <trpc.Provider client={client} queryClient={queryClient}>
                <QueryClientProvider client={queryClient}>
                    <MemoryRouter initialEntries={['/settings/probe']}>
                        <Routes>
                            <Route element={<AppLayoutProbe />} path="/settings">
                                <Route element={<SettingsLayout />}>
                                    <Route element={<SettingsChildProbe />} path="probe" />
                                </Route>
                            </Route>
                        </Routes>
                    </MemoryRouter>
                </QueryClientProvider>
            </trpc.Provider>
        );

        expect(markup).toContain('settings context available');
    });

    test('adds extra top space in sidebar app layout', () => {
        const markup = renderSettingsContent('sidebar');

        expect(markup).toContain('pt-12');
    });

    test('keeps the tighter top space in tabs app layout', () => {
        const markup = renderSettingsContent('tabs');

        expect(markup).toContain('pt-6');
        expect(markup).not.toContain('pt-12');
    });
});

function renderSettingsContent(appLayoutMode: 'sidebar' | 'tabs') {
    return renderToStaticMarkup(
        <MemoryRouter initialEntries={['/settings/probe']}>
            <Routes>
                <Route
                    element={
                        <SettingsContent
                            appLayoutMode={appLayoutMode}
                            layoutContext={{ navigateToSettings: () => undefined }}
                        />
                    }
                    path="/settings/probe"
                />
            </Routes>
        </MemoryRouter>
    );
}

function AppLayoutProbe() {
    return <Outlet context={{ navigateToSettings: () => undefined }} />;
}

function SettingsChildProbe() {
    const { navigateToSettings } = useLayoutContext();

    return (
        <button onClick={navigateToSettings} type="button">
            settings context available
        </button>
    );
}
