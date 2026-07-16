import * as React from 'react';
import { RouterProvider } from 'react-router-dom';
import { createAppRouter } from './app-router.tsx';
import { AgentDrawerProvider } from './features/chats/agent-drawer-context.tsx';
import { CommandMenu } from './features/shell/command-menu.tsx';

export default function App() {
    const router = React.useMemo(() => createAppRouter(), []);

    return (
        <AgentDrawerProvider>
            <CommandMenu router={router} />
            <RouterProvider router={router} />
        </AgentDrawerProvider>
    );
}
