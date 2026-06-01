import { Outlet } from 'react-router-dom';

export function AppFrame() {
    return (
        <div className="app-window-shell min-h-screen">
            <Outlet />
        </div>
    );
}
