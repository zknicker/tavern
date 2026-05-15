import net from 'node:net';
import { fileURLToPath } from 'node:url';

function getFreePort() {
    return new Promise<number>((resolve, reject) => {
        const server = net.createServer();

        server.listen(0, '127.0.0.1', () => {
            const address = server.address();

            if (!address || typeof address === 'string') {
                server.close();
                reject(new Error('Failed to acquire a free port for Playwright e2e.'));
                return;
            }

            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve(address.port);
            });
        });

        server.on('error', reject);
    });
}

const websiteRoot = fileURLToPath(new URL('../', import.meta.url));
const runId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const [gatewayPort, runtimePort, serverPort, websitePort] = await Promise.all([
    getFreePort(),
    getFreePort(),
    getFreePort(),
    getFreePort(),
]);
const gatewayUrl = `ws://127.0.0.1:${gatewayPort}`;
const gatewayToken = `tavern-live-e2e-${runId}`;
const command = [process.execPath, 'x', 'playwright', 'test', ...process.argv.slice(2)];

const child = Bun.spawn(command, {
    cwd: websiteRoot,
    env: {
        ...process.env,
        TAVERN_E2E_MODE: 'live-openclaw',
        TAVERN_E2E_RUN_ID: runId,
        TAVERN_E2E_TEST_DIR: './e2e/live',
        TAVERN_RUNTIME_PORT: `${runtimePort}`,
        TAVERN_OPENCLAW_GATEWAY_PORT: `${gatewayPort}`,
        TAVERN_SERVER_PORT: `${serverPort}`,
        TAVERN_WEBSITE_PORT: `${websitePort}`,
        TAVERN_RUNTIME_URL: `http://127.0.0.1:${runtimePort}`,
        OPENCLAW_GATEWAY_TOKEN: gatewayToken,
        OPENCLAW_GATEWAY_URL: gatewayUrl,
    },
    stderr: 'inherit',
    stdin: 'inherit',
    stdout: 'inherit',
});

process.exit(await child.exited);
