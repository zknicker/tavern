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
const [mockProviderPort, gatewayPort, runtimePort, serverPort, websitePort] = await Promise.all([
    getFreePort(),
    getFreePort(),
    getFreePort(),
    getFreePort(),
    getFreePort(),
]);
const gatewayToken = `tavern-e2e-${runId}`;
const command = [process.execPath, 'x', 'playwright', 'test', ...process.argv.slice(2)];

const child = Bun.spawn(command, {
    cwd: websiteRoot,
    env: {
        ...process.env,
        TAVERN_E2E_RUN_ID: runId,
        TAVERN_MOCK_PROVIDER_PORT: `${mockProviderPort}`,
        TAVERN_OPENCLAW_GATEWAY_PORT: `${gatewayPort}`,
        TAVERN_RUNTIME_PORT: `${runtimePort}`,
        TAVERN_SERVER_PORT: `${serverPort}`,
        TAVERN_WEBSITE_PORT: `${websitePort}`,
        TAVERN_RUNTIME_URL: `http://127.0.0.1:${runtimePort}`,
        OPENCLAW_GATEWAY_TOKEN: gatewayToken,
        OPENCLAW_GATEWAY_URL: `ws://127.0.0.1:${gatewayPort}`,
    },
    stderr: 'inherit',
    stdin: 'inherit',
    stdout: 'inherit',
});

process.exit(await child.exited);
