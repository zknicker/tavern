import { Outlet } from 'react-router-dom';
import { DesktopUpdateIndicator } from './desktop-update-indicator.tsx';

export function AppFrame() {
    return (
        <div className="app-window-shell min-h-screen">
            <DesktopUpdateIndicator />
            <Outlet />
        </div>
    );
}
