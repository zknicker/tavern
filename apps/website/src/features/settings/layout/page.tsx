import { Outlet } from 'react-router-dom';
import { useAppLayoutPreference } from '../../../hooks/dashboard/use-app-layout-preference.ts';
import { SettingsSidebarNav } from './sidebar-nav.tsx';

export function SettingsLayout() {
    const appLayout = useAppLayoutPreference();

    if (appLayout.mode === 'sidebar') {
        return <SettingsContent />;
    }

    return (
        <div className="grid min-h-full grid-cols-[260px_minmax(0,1fr)] md:h-full md:min-h-0">
            <aside className="flex min-h-0 w-[260px] shrink-0 flex-col border-border/60 border-r bg-transparent">
                <SettingsSidebarNav />
            </aside>
            <SettingsContent />
        </div>
    );
}

function SettingsContent() {
    return (
        <section className="flex min-h-0 flex-1 flex-col overflow-y-scroll [scrollbar-gutter:stable]">
            <div className="mx-auto w-full max-w-5xl px-12 pt-6 pb-16">
                <Outlet />
            </div>
        </section>
    );
}
