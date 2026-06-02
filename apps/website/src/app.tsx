import * as React from 'react';
import { RouterProvider } from 'react-router-dom';
import { createAppRouter } from './app-router.tsx';
import { DesktopUpdateIndicator } from './components/desktop-update-indicator.tsx';

export default function App() {
    const router = React.useMemo(() => createAppRouter(), []);

    return (
        <>
            <DesktopUpdateIndicator />
            <RouterProvider router={router} />
        </>
    );
}
