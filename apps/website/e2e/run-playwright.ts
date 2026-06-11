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
const [hermesPort, hermesProviderPort, runtimePort, serverPort, websitePort] = await Promise.all([
    getFreePort(),
    getFreePort(),
    getFreePort(),
    getFreePort(),
    getFreePort(),
]);
const command = [process.execPath, 'x', 'playwright', 'test', ...process.argv.slice(2)];
const runtimeToken = process.env.TAVERN_RUNTIME_TOKEN ?? 'e2e-runtime-token';
const env = {
    ...process.env,
    TAVERN_E2E_RUN_ID: runId,
    // Same engine policy as the dev stack: reuse the machine's Hermes and
    // never bootstrap-download a pinned engine in the middle of a test run.
    TAVERN_HERMES_ALLOW_SYSTEM: process.env.TAVERN_HERMES_ALLOW_SYSTEM ?? '1',
    TAVERN_HERMES_AUTO_INSTALL: process.env.TAVERN_HERMES_AUTO_INSTALL ?? '0',
    TAVERN_HERMES_API_KEY: 'tavern-e2e-mock-key',
    TAVERN_HERMES_BASE_URL: `http://127.0.0.1:${hermesProviderPort}/v1`,
    TAVERN_HERMES_MODEL: 'tavern-e2e-tools',
    TAVERN_HERMES_PORT: `${hermesPort}`,
    TAVERN_HERMES_PROVIDER: 'custom',
    TAVERN_HERMES_PROVIDER_PORT: `${hermesProviderPort}`,
    TAVERN_RUNTIME_PORT: `${runtimePort}`,
    TAVERN_RUNTIME_TOKEN: runtimeToken,
    TAVERN_RUNTIME_URL: `http://127.0.0.1:${runtimePort}`,
    TAVERN_SERVER_PORT: `${serverPort}`,
    TAVERN_WEBSITE_PORT: `${websitePort}`,
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
