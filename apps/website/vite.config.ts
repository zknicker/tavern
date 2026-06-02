import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const websitePort = Number(process.env.TAVERN_WEBSITE_PORT ?? '3100');
const serverPort = Number(process.env.TAVERN_SERVER_PORT ?? '8080');
const serverOrigin = `http://localhost:${serverPort}`;

export default defineConfig(({ command }) => ({
    base: command === 'build' ? './' : '/',
    plugins: [tailwindcss(), react()],
    server: {
        port: websitePort,
        strictPort: true,
        proxy: {
            '/healthz': {
                target: serverOrigin,
            },
            '/trpc': {
                target: serverOrigin,
                ws: true,
            },
        },
    },
}));
