import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const e2eMode = process.env.TAVERN_E2E_MODE ?? 'mock-provider';
const runId = process.env.TAVERN_E2E_RUN_ID ?? 'default';
const mockProviderPort = Number.parseInt(process.env.TAVERN_MOCK_PROVIDER_PORT ?? '44080', 10);
const gatewayPort = Number.parseInt(process.env.TAVERN_OPENCLAW_GATEWAY_PORT ?? '18789', 10);
const runtimePort = Number.parseInt(process.env.TAVERN_RUNTIME_PORT ?? '4310', 10);
const serverPort = Number.parseInt(process.env.TAVERN_SERVER_PORT ?? '8081', 10);
const websitePort = Number.parseInt(process.env.TAVERN_WEBSITE_PORT ?? '3101', 10);
const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN ?? `tavern-e2e-${runId}`;
const liveGatewayUrl = process.env.OPENCLAW_GATEWAY_URL ?? 'ws://127.0.0.1:18789';
const runtimeWebServerTimeoutMs = Number.parseInt(
    process.env.TAVERN_RUNTIME_WEBSERVER_TIMEOUT_MS ?? '180000',
    10
);
const mentionPluginRoot = fileURLToPath(new URL('./e2e/fixtures/codex-plugins/', import.meta.url));

export default defineConfig({
    fullyParallel: false,
    reporter: 'list',
    testDir: process.env.TAVERN_E2E_TEST_DIR ?? './e2e/tests',
    use: {
        baseURL: `http://127.0.0.1:${websitePort}`,
        trace: 'retain-on-failure',
    },
    webServer: buildWebServers(),
    workers: 1,
});

function buildWebServers() {
    if (e2eMode === 'live-openclaw') {
        return [
            {
                command: `TAVERN_E2E_RUN_ID=${runId} TAVERN_RUNTIME_PORT=${runtimePort} OPENCLAW_GATEWAY_URL=${liveGatewayUrl} bun e2e/start-tavern-runtime.ts`,
                reuseExistingServer: false,
                stderr: 'pipe',
                stdout: 'pipe',
                timeout: runtimeWebServerTimeoutMs,
                url: `http://127.0.0.1:${runtimePort}/capabilities`,
            },
            {
                command: `TAVERN_E2E_RUN_ID=${runId} SERVER_PORT=${serverPort} APP_ORIGIN=http://127.0.0.1:${websitePort} TAVERN_RUNTIME_URL=http://127.0.0.1:${runtimePort} TAVERN_MENTION_CODEX_PLUGIN_ROOT=${mentionPluginRoot} bun e2e/start-tavern-server.ts`,
                reuseExistingServer: false,
                stderr: 'pipe',
                stdout: 'pipe',
                timeout: 30_000,
                url: `http://127.0.0.1:${serverPort}/healthz`,
            },
            {
                command: `VITE_SERVER_ORIGIN=http://127.0.0.1:${serverPort} TAVERN_WEBSITE_PORT=${websitePort} TAVERN_SERVER_PORT=${serverPort} bun run dev -- --host 127.0.0.1 --port ${websitePort}`,
                reuseExistingServer: false,
                stderr: 'pipe',
                stdout: 'pipe',
                timeout: 30_000,
                url: `http://127.0.0.1:${websitePort}`,
            },
        ];
    }

    return [
        {
            command: `TAVERN_MOCK_PROVIDER_PORT=${mockProviderPort} bun e2e/openclaw/start-mock-provider.ts`,
            reuseExistingServer: false,
            stderr: 'pipe',
            stdout: 'pipe',
            timeout: 30_000,
            url: `http://127.0.0.1:${mockProviderPort}/healthz`,
        },
        {
            command: `TAVERN_E2E_RUN_ID=${runId} TAVERN_RUNTIME_PORT=${runtimePort} OPENCLAW_GATEWAY_URL=ws://127.0.0.1:${gatewayPort} OPENCLAW_GATEWAY_TOKEN=${gatewayToken} bun e2e/start-tavern-runtime.ts`,
            reuseExistingServer: false,
            stderr: 'pipe',
            stdout: 'pipe',
            timeout: runtimeWebServerTimeoutMs,
            url: `http://127.0.0.1:${runtimePort}/capabilities`,
        },
        {
            command: `TAVERN_E2E_RUN_ID=${runId} SERVER_PORT=${serverPort} APP_ORIGIN=http://127.0.0.1:${websitePort} TAVERN_RUNTIME_URL=http://127.0.0.1:${runtimePort} TAVERN_MENTION_CODEX_PLUGIN_ROOT=${mentionPluginRoot} bun e2e/start-tavern-server.ts`,
            reuseExistingServer: false,
            stderr: 'pipe',
            stdout: 'pipe',
            timeout: 30_000,
            url: `http://127.0.0.1:${serverPort}/healthz`,
        },
        {
            command: `VITE_SERVER_ORIGIN=http://127.0.0.1:${serverPort} TAVERN_WEBSITE_PORT=${websitePort} TAVERN_SERVER_PORT=${serverPort} bun run dev -- --host 127.0.0.1 --port ${websitePort}`,
            reuseExistingServer: false,
            stderr: 'pipe',
            stdout: 'pipe',
            timeout: 30_000,
            url: `http://127.0.0.1:${websitePort}`,
        },
    ];
}
