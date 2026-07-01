import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { useLayoutContext } from '../../shell/use-layout-context.ts';
import { SettingsLayout } from './page.tsx';

describe('SettingsLayout', () => {
    test('forwards the app layout context to settings child routes', () => {
        const markup = renderToStaticMarkup(
            <MemoryRouter initialEntries={['/settings/probe']}>
                <Routes>
                    <Route element={<AppLayoutProbe />} path="/settings">
                        <Route element={<SettingsLayout />}>
                            <Route element={<SettingsChildProbe />} path="probe" />
                        </Route>
                    </Route>
                </Routes>
            </MemoryRouter>
        );

        expect(markup).toContain('settings context available');
    });

    test('adds extra top space in sidebar app layout', () => {
        const markup = renderToStaticMarkup(
            <MemoryRouter initialEntries={['/settings/probe']}>
                <Routes>
                    <Route element={<AppLayoutProbe />} path="/settings">
                        <Route element={<SettingsLayout />}>
                            <Route element={<SettingsChildProbe />} path="probe" />
                        </Route>
                    </Route>
                </Routes>
            </MemoryRouter>
        );

        expect(markup).toContain('pt-12');
    });
});

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
