import { Outlet, useLocation } from 'react-router-dom';
import { useAppLayoutPreference } from '../../../hooks/shell/use-app-layout-preference.ts';
import { appRoutes } from '../../../lib/app-routes.ts';
import { useLayoutContext } from '../../shell/use-layout-context.ts';
import { SettingsSidebarNav } from './sidebar-nav.tsx';

export function SettingsLayout() {
    const appLayout = useAppLayoutPreference();
    const layoutContext = useLayoutContext();

    if (appLayout.mode === 'sidebar') {
        return <SettingsContent appLayoutMode={appLayout.mode} layoutContext={layoutContext} />;
    }

    return (
        <div className="grid min-h-full grid-cols-[220px_minmax(0,1fr)] md:h-full md:min-h-0">
            <aside className="flex min-h-0 w-[220px] shrink-0 flex-col border-sidebar-border border-r bg-[var(--sidebar)]">
                <SettingsSidebarNav />
            </aside>
            <SettingsContent appLayoutMode={appLayout.mode} layoutContext={layoutContext} />
        </div>
    );
}

function SettingsContent({
    appLayoutMode,
    layoutContext,
}: {
    appLayoutMode: ReturnType<typeof useAppLayoutPreference>['mode'];
    layoutContext: ReturnType<typeof useLayoutContext>;
}) {
    const location = useLocation();
    // Only the global Skills page is the full-bleed library browser. The
    // agent Skills tab is a normal padded settings page (enablement toggles).
    const isFullContentRoute = location.pathname === appRoutes.settingsSkills;

    return (
        <section
            className={
                isFullContentRoute
                    ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
                    : 'flex min-h-0 flex-1 flex-col overflow-y-scroll [scrollbar-gutter:stable]'
            }
        >
            <div
                className={
                    isFullContentRoute
                        ? 'h-full min-h-0 w-full flex-1'
                        : appLayoutMode === 'sidebar'
                          ? 'mx-auto w-full max-w-5xl px-12 pt-12 pb-16'
                          : 'mx-auto w-full max-w-5xl px-12 pt-6 pb-16'
                }
            >
                <Outlet context={layoutContext} />
            </div>
        </section>
    );
}
