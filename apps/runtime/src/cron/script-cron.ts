import path from 'node:path';
import type { AgentRuntimeCron, AgentRuntimeCronRun } from '@tavern/api';
import type { Database } from '../db/sqlite.ts';
import { getStoredAgent } from '../tavern/agents-store.ts';
import { runCronAgentTurn } from './agent-turn-cron.ts';
import { finishCronRun } from './run-lifecycle.ts';
import { type CronScriptResult, runCronScript } from './script-runner.ts';

/**
 * Script-mode cron contract: the command runs server-side at zero model cost.
 * Exit 0 with empty stdout — or a `{"wakeAgent": false}` sentinel — is a
 * quiet tick: the run is recorded, nothing posts, no turn dispatches. Any
 * other stdout is delivered into the chat as the automation message, which
 * starts an agent turn exactly like agent-mode deliveries. Non-zero exits and
 * timeouts record an error run with exit code and stderr, posting nothing.
 */
export async function runScriptCron(input: {
    db: Database;
    job: AgentRuntimeCron;
    runId: string;
    startedAt: string;
}): Promise<AgentRuntimeCronRun> {
    const { db, job, runId, startedAt } = input;
    if (job.payload.kind !== 'script') {
        throw new Error('Cron payload is not a script.');
    }
    const result = await runCronScript({
        command: job.payload.command,
        cwd: resolveScriptWorkingDir(job.agentId, job.payload.workingDir, db),
    });
    const script = { exitCode: result.exitCode, stderr: result.stderr || null };
    const outcome = interpretScriptResult(result);
    if (outcome.kind === 'alert') {
        return await runCronAgentTurn({
            db,
            job,
            message: outcome.message,
            runId,
            script,
            startedAt,
        });
    }
    return finishCronRun({
        db,
        ...(outcome.kind === 'error'
            ? { errorCode: 'execution_failed' as const, message: outcome.message }
            : { quiet: true }),
        jobId: job.id,
        runId,
        scriptExitCode: script.exitCode,
        scriptStderr: script.stderr,
        startedAt,
        status: outcome.kind === 'error' ? 'error' : 'success',
    });
}

type ScriptOutcome =
    | { kind: 'alert'; message: string }
    | { kind: 'error'; message: string }
    | { kind: 'quiet' };

export function interpretScriptResult(result: CronScriptResult): ScriptOutcome {
    if (result.timedOut) {
        return { kind: 'error', message: 'Script timed out.' };
    }
    if (result.exitCode !== 0) {
        const detail = result.stderr.trim().split('\n').at(-1)?.slice(0, 200);
        return {
            kind: 'error',
            message: `Script exited with code ${result.exitCode ?? 'null'}${detail ? `: ${detail}` : '.'}`,
        };
    }
    const stdout = result.stdout.trim();
    if (stdout.length === 0 || readWakeAgentSentinel(stdout) === false) {
        return { kind: 'quiet' };
    }
    return { kind: 'alert', message: stdout };
}

function readWakeAgentSentinel(stdout: string): boolean | null {
    if (!stdout.startsWith('{')) {
        return null;
    }
    try {
        const parsed: unknown = JSON.parse(stdout);
        if (parsed && typeof parsed === 'object' && 'wakeAgent' in parsed) {
            return typeof parsed.wakeAgent === 'boolean' ? parsed.wakeAgent : null;
        }
    } catch {
        return null;
    }
    return null;
}

function resolveScriptWorkingDir(
    agentId: string,
    workingDir: string | undefined,
    db: Database
): string {
    const agent = getStoredAgent(agentId, db);
    if (!agent) {
        throw new Error(`Cron agent "${agentId}" does not exist.`);
    }
    if (!workingDir) {
        return agent.workspaceFolder;
    }
    return path.isAbsolute(workingDir)
        ? workingDir
        : path.resolve(agent.workspaceFolder, workingDir);
}
