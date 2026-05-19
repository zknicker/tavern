import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = fileURLToPath(new URL('../../../', import.meta.url));
const runId = process.env.TAVERN_E2E_RUN_ID ?? 'default';
const runtimeRoot = path.join(workspaceRoot, '.context', 'e2e', runId, 'tavern-runtime');

rmSync(runtimeRoot, { force: true, recursive: true });
mkdirSync(runtimeRoot, { recursive: true });
mkdirSync(path.join(runtimeRoot, 'openclaw', 'run', 'workspace'), { recursive: true });
writeFileSync(
    path.join(runtimeRoot, 'openclaw', 'run', 'workspace', 'QA_KICKOFF_TASK.md'),
    '# QA kickoff task\n\nThis file exists so e2e tool-read tests can inspect a deterministic workspace fixture.\n'
);

process.env.TAVERN_RUNTIME_ROOT = runtimeRoot;
process.env.TAVERN_OPENCLAW_PLUGIN_DEPLOY_PATH = path.join(
    runtimeRoot,
    'openclaw-plugins',
    'tavern-openclaw-messenger'
);
process.env.TAVERN_OPENCLAW_CORTEX_PLUGIN_DEPLOY_PATH = path.join(
    runtimeRoot,
    'openclaw-plugins',
    'tavern-openclaw-cortex'
);
process.env.TAVERN_OPENCLAW_WORKSPACE_PLUGIN_DEPLOY_PATH = path.join(
    runtimeRoot,
    'openclaw-plugins',
    'tavern-openclaw-workspace'
);
process.env.NODE_ENV = 'test';

process.chdir(workspaceRoot);

await import('../../runtime/src/index.ts');
