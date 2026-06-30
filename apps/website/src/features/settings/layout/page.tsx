import { Outlet, useLocation } from 'react-router-dom';
import { useAppLayoutPreference } from '../../../hooks/shell/use-app-layout-preference.ts';
import { appRoutes } from '../../../lib/app-routes.ts';
import { getActiveAgentPage } from '../../agents/agent-path.ts';
import { useLayoutContext } from '../../shell/use-layout-context.ts';
import { SettingsSidebarNav } from './sidebar-nav.tsx';

export function SettingsLayout() {
    const appLayout = useAppLayoutPreference();
    const layoutContext = useLayoutContext();

    if (appLayout.mode === 'sidebar') {
        return <SettingsContent layoutContext={layoutContext} />;
    }

    return (
        <div className="grid min-h-full grid-cols-[260px_minmax(0,1fr)] md:h-full md:min-h-0">
            <aside className="flex min-h-0 w-[260px] shrink-0 flex-col border-sidebar-border border-r bg-[var(--sidebar)]">
                <SettingsSidebarNav />
            </aside>
            <SettingsContent layoutContext={layoutContext} />
        </div>
    );
}

function SettingsContent({
    layoutContext,
}: {
    layoutContext: ReturnType<typeof useLayoutContext>;
}) {
    const location = useLocation();
    const activeAgentPage = getActiveAgentPage(location.pathname);
    const isFullContentRoute =
        location.pathname === appRoutes.settingsSkills || activeAgentPage?.tab === 'skills';

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
                        : 'mx-auto w-full max-w-5xl px-12 pt-6 pb-16'
                }
            >
                <Outlet context={layoutContext} />
            </div>
        </section>
    );
}
