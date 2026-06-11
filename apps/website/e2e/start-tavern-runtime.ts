import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = fileURLToPath(new URL('../../../', import.meta.url));
const runId = process.env.TAVERN_E2E_RUN_ID ?? 'default';
const runtimeRoot = path.join(workspaceRoot, '.context', 'e2e', runId, 'tavern-runtime');

rmSync(runtimeRoot, { force: true, recursive: true });
mkdirSync(runtimeRoot, { recursive: true });
mkdirSync(path.join(runtimeRoot, 'hermes', 'workspace'), { recursive: true });
writeFileSync(
    path.join(runtimeRoot, 'hermes', 'workspace', 'QA_KICKOFF_TASK.md'),
    '# QA kickoff task\n\nThis file exists so e2e tool-read tests can inspect a deterministic workspace fixture.\n'
);

process.env.TAVERN_RUNTIME_ROOT = runtimeRoot;
process.env.TAVERN_HERMES_HOME = path.join(runtimeRoot, 'hermes', 'home');
process.env.TAVERN_RUNTIME_TOKEN = process.env.TAVERN_RUNTIME_TOKEN ?? 'e2e-runtime-token';
process.env.NODE_ENV = 'test';

process.chdir(workspaceRoot);

// The runtime entry dispatches on argv and only starts the server on the `serve` subcommand.
process.argv = [process.argv[0] ?? 'bun', process.argv[1] ?? 'start-tavern-runtime.ts', 'serve'];

await import('../../runtime/src/index.ts');
