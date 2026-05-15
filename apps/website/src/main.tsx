import { isTauri } from '@tauri-apps/api/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app.tsx';
import { ThemeProvider } from './components/theme-provider.tsx';
import { TavernProviders } from './lib/trpc.tsx';
import './styles/global.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
    throw new Error('Root element not found.');
}

if (isTauri() && navigator.userAgent.includes('Mac')) {
    document.documentElement.classList.add('macos-tauri');
}

createRoot(rootElement).render(
    <StrictMode>
        <ThemeProvider>
            <TavernProviders>
                <App />
            </TavernProviders>
        </ThemeProvider>
    </StrictMode>
);
