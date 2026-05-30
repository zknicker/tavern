import { Outlet } from 'react-router-dom';
import { OpenClawSettingsLeaveGuard } from '../openclaw-draft/leave-guard.tsx';
import { OpenClawSettingsDraftProvider } from '../openclaw-draft/provider.tsx';
import { OpenClawSettingsSaveBar } from '../openclaw-draft/save-bar.tsx';

export function SettingsLayout() {
    return (
        <OpenClawSettingsDraftProvider>
            <div className="flex min-h-full flex-col md:h-full md:min-h-0">
                <section className="flex min-h-0 flex-1 flex-col overflow-y-scroll [scrollbar-gutter:stable]">
                    <div className="mx-auto w-full max-w-5xl px-12 pt-14 pb-16">
                        <Outlet />
                    </div>
                    <OpenClawSettingsSaveBar />
                </section>
                <OpenClawSettingsLeaveGuard />
            </div>
        </OpenClawSettingsDraftProvider>
    );
}
