import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { resolveE2eOpenClawInstallRoot } from './e2e-cache.ts';

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
const env = {
    ...process.env,
    TAVERN_E2E_RUN_ID: runId,
    TAVERN_MOCK_PROVIDER_PORT: `${mockProviderPort}`,
    TAVERN_OPENCLAW_GATEWAY_PORT: `${gatewayPort}`,
    TAVERN_OPENCLAW_INSTALL_ROOT: resolveE2eOpenClawInstallRoot(),
    TAVERN_RUNTIME_PORT: `${runtimePort}`,
    TAVERN_SERVER_PORT: `${serverPort}`,
    TAVERN_WEBSITE_PORT: `${websitePort}`,
    TAVERN_RUNTIME_URL: `http://127.0.0.1:${runtimePort}`,
    OPENCLAW_GATEWAY_TOKEN: gatewayToken,
    OPENCLAW_GATEWAY_URL: `ws://127.0.0.1:${gatewayPort}`,
};

await runPreflight(env);

const child = Bun.spawn(command, {
    cwd: websiteRoot,
    env,
    stderr: 'inherit',
    stdin: 'inherit',
    stdout: 'inherit',
});

process.exit(await child.exited);

async function runPreflight(env: NodeJS.ProcessEnv) {
    const child = Bun.spawn([process.execPath, 'e2e/preflight.ts'], {
        cwd: websiteRoot,
        env,
        stderr: 'inherit',
        stdin: 'inherit',
        stdout: 'inherit',
    });

    const exitCode = await child.exited;

    if (exitCode !== 0) {
        process.exit(exitCode);
    }
}
