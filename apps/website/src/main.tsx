import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app.tsx';
import { DevModeProvider } from './components/dev-mode-provider.tsx';
import { ThemeProvider } from './components/theme-provider.tsx';
import { DesktopEditContextMenuProvider } from './components/ui/edit-context-menu.tsx';
import { ToastProvider } from './components/ui/toast.tsx';
import { ChromeApp } from './features/shell/browser-shell/chrome-app.tsx';
import { TavernClerkProvider } from './lib/clerk.tsx';
import { getDesktopSurface, isElectronDesktopApp } from './lib/desktop-bridge.ts';
import { TavernProviders } from './lib/trpc.tsx';
import './styles/global.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
    throw new Error('Root element not found.');
}

if (isElectronDesktopApp() && navigator.userAgent.includes('Mac')) {
    document.documentElement.classList.add('macos-electron');
}

// 'chrome' renders just the tab strip + toolbar; each tab's page is a separate content view.
// 'content'/web render the normal routed app (Layout drops the shell on content views).
const isChromeSurface = getDesktopSurface() === 'chrome';

createRoot(rootElement).render(
    <StrictMode>
        <TavernClerkProvider>
            <ThemeProvider>
                <DevModeProvider>
                    <ToastProvider>
                        <TavernProviders>
                            <DesktopEditContextMenuProvider>
                                {isChromeSurface ? <ChromeApp /> : <App />}
                            </DesktopEditContextMenuProvider>
                        </TavernProviders>
                    </ToastProvider>
                </DevModeProvider>
            </ThemeProvider>
        </TavernClerkProvider>
    </StrictMode>
);
