import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildOpenClawE2eConfig } from './config.ts';

const workspaceRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const runId = process.env.TAVERN_E2E_RUN_ID ?? 'default';
const gatewayPort = Number.parseInt(process.env.TAVERN_OPENCLAW_GATEWAY_PORT ?? '18789', 10);
const mockProviderPort = Number.parseInt(process.env.TAVERN_MOCK_PROVIDER_PORT ?? '44080', 10);
const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN ?? `tavern-e2e-${runId}`;
const runRoot = path.join(workspaceRoot, '.context', 'e2e', runId, 'openclaw');
const stateDir = path.join(runRoot, 'state');
const workspaceDir = path.join(runRoot, 'workspace');
const configPath = path.join(runRoot, 'openclaw.json');
const pluginPath = path.join(workspaceRoot, 'packages', 'tavern-openclaw-messenger');
const cortexPluginPath = path.join(workspaceRoot, 'packages', 'tavern-openclaw-cortex');
const workspacePluginPath = path.join(workspaceRoot, 'packages', 'tavern-openclaw-workspace');
const openClawBin = path.join(workspaceRoot, 'node_modules', '.bin', 'openclaw');

mkdirSync(stateDir, { recursive: true });
mkdirSync(workspaceDir, { recursive: true });
writeFileSync(
    path.join(workspaceDir, 'QA_KICKOFF_TASK.md'),
    '# QA kickoff task\n\nThis file exists so e2e tool-read tests can inspect a deterministic workspace fixture.\n'
);
writeFileSync(
    configPath,
    `${JSON.stringify(
        buildOpenClawE2eConfig({
            cortexPluginPath,
            gatewayPort,
            gatewayToken,
            pluginPath,
            providerBaseUrl: `http://127.0.0.1:${mockProviderPort}/v1`,
            workspacePluginPath,
            workspaceDir,
        }),
        null,
        2
    )}\n`
);

const child = Bun.spawn(
    [
        openClawBin,
        'gateway',
        'run',
        '--port',
        `${gatewayPort}`,
        '--bind',
        'loopback',
        '--auth',
        'token',
        '--token',
        gatewayToken,
    ],
    {
        cwd: workspaceRoot,
        env: {
            ...process.env,
            NODE_ENV: 'test',
            OPENCLAW_CONFIG_PATH: configPath,
            OPENCLAW_GATEWAY_TOKEN: gatewayToken,
            OPENCLAW_STATE_DIR: stateDir,
        },
        stderr: 'inherit',
        stdout: 'inherit',
    }
);

function shutdown() {
    child.kill('SIGTERM');
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

process.exit(await child.exited);
