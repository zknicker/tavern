import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app.tsx';
import { ThemeProvider } from './components/theme-provider.tsx';
import { DesktopEditContextMenuProvider } from './components/ui/edit-context-menu.tsx';
import { isElectronDesktopApp } from './lib/desktop-bridge.ts';
import { TavernProviders } from './lib/trpc.tsx';
import './styles/global.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
    throw new Error('Root element not found.');
}

if (isElectronDesktopApp() && navigator.userAgent.includes('Mac')) {
    document.documentElement.classList.add('macos-electron');
}

createRoot(rootElement).render(
    <StrictMode>
        <ThemeProvider>
            <TavernProviders>
                <DesktopEditContextMenuProvider>
                    <App />
                </DesktopEditContextMenuProvider>
            </TavernProviders>
        </ThemeProvider>
    </StrictMode>
);
