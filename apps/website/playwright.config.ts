import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const runId = process.env.TAVERN_E2E_RUN_ID ?? 'default';
const hermesBaseUrl = process.env.TAVERN_HERMES_BASE_URL ?? 'http://127.0.0.1:44080/v1';
const hermesModel = process.env.TAVERN_HERMES_MODEL ?? 'tavern-e2e-tools';
const hermesProvider = process.env.TAVERN_HERMES_PROVIDER ?? 'custom';
const hermesProviderPort = Number.parseInt(process.env.TAVERN_HERMES_PROVIDER_PORT ?? '44080', 10);
const hermesToken = process.env.TAVERN_HERMES_TOKEN ?? `tavern-e2e-hermes-${runId}`;
const hermesPort = Number.parseInt(process.env.TAVERN_HERMES_PORT ?? '9119', 10);
const runtimePort = Number.parseInt(process.env.TAVERN_RUNTIME_PORT ?? '18790', 10);
const serverPort = Number.parseInt(process.env.TAVERN_SERVER_PORT ?? '8081', 10);
const websitePort = Number.parseInt(process.env.TAVERN_WEBSITE_PORT ?? '3101', 10);
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
    return [
        {
            command: [
                `TAVERN_E2E_RUN_ID=${runId}`,
                `TAVERN_HERMES_MODEL=${hermesModel}`,
                `TAVERN_HERMES_PROVIDER_PORT=${hermesProviderPort}`,
                'bun e2e/hermes/start-mock-provider.ts',
            ].join(' '),
            reuseExistingServer: false,
            stderr: 'pipe',
            stdout: 'pipe',
            timeout: 30_000,
            url: `http://127.0.0.1:${hermesProviderPort}/health`,
        },
        {
            command: [
                `TAVERN_E2E_RUN_ID=${runId}`,
                `TAVERN_RUNTIME_PORT=${runtimePort}`,
                `TAVERN_HERMES_BASE_URL=${hermesBaseUrl}`,
                `TAVERN_HERMES_MODEL=${hermesModel}`,
                `TAVERN_HERMES_PORT=${hermesPort}`,
                'TAVERN_HERMES_API_KEY=tavern-e2e-mock-key',
                `TAVERN_HERMES_PROVIDER=${hermesProvider}`,
                `TAVERN_HERMES_TOKEN=${hermesToken}`,
                // e2e must never download an engine; resolve the dev machine's Hermes.
                'TAVERN_HERMES_ALLOW_SYSTEM=1',
                'TAVERN_HERMES_AUTO_INSTALL=0',
                'bun e2e/start-tavern-runtime.ts',
            ].join(' '),
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
