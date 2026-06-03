import { Outlet } from 'react-router-dom';
import { SettingsSidebarNav } from './sidebar-nav.tsx';

export function SettingsLayout() {
    return (
        <div className="grid min-h-full grid-cols-[260px_minmax(0,1fr)] md:h-full md:min-h-0">
            <SettingsSidebarNav />
            <section className="flex min-h-0 flex-1 flex-col overflow-y-scroll [scrollbar-gutter:stable]">
                <div className="mx-auto w-full max-w-5xl px-12 pt-6 pb-16">
                    <Outlet />
                </div>
            </section>
        </div>
    );
}
