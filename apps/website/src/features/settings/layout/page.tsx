import { Outlet } from 'react-router-dom';
import { OpenClawSettingsLeaveGuard } from '../openclaw-draft/leave-guard.tsx';
import { OpenClawSettingsDraftProvider } from '../openclaw-draft/provider.tsx';
import { OpenClawSettingsSaveBar } from '../openclaw-draft/save-bar.tsx';

export function SettingsLayout() {
    return (
        <OpenClawSettingsDraftProvider>
            <div className="flex min-h-full flex-col md:h-full md:min-h-0">
                <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                    <div className="mx-auto w-full max-w-5xl px-6 pt-9 pb-10">
                        <Outlet />
                    </div>
                    <OpenClawSettingsSaveBar />
                </section>
                <OpenClawSettingsLeaveGuard />
            </div>
        </OpenClawSettingsDraftProvider>
    );
}
