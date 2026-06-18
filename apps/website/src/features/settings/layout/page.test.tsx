import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { useLayoutContext } from '../../shell/use-layout-context.ts';
import { SettingsLayout } from './page.tsx';

describe('SettingsLayout', () => {
    test('forwards the dashboard layout context to settings child routes', () => {
        const markup = renderToStaticMarkup(
            <MemoryRouter initialEntries={['/settings/probe']}>
                <Routes>
                    <Route element={<DashboardLayoutProbe />} path="/settings">
                        <Route element={<SettingsLayout />}>
                            <Route element={<SettingsChildProbe />} path="probe" />
                        </Route>
                    </Route>
                </Routes>
            </MemoryRouter>
        );

        expect(markup).toContain('settings context available');
    });
});

function DashboardLayoutProbe() {
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
