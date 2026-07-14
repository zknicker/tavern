import { spawn } from 'node:child_process';

/**
 * Runs a cron script with `sh -c` in the resolved working directory. Scripts
 * execute with the same local trust as the agent's own shell tool; the caps
 * here bound runtime and output size, not permissions.
 */

export interface CronScriptResult {
    exitCode: number | null;
    stderr: string;
    stdout: string;
    timedOut: boolean;
}

export const cronScriptLimits = {
    maxStderrBytes: 8 * 1024,
    maxStdoutBytes: 16 * 1024,
    timeoutMs: 120_000,
};

export function runCronScript(input: {
    command: string;
    cwd: string;
    maxStderrBytes?: number;
    maxStdoutBytes?: number;
    timeoutMs?: number;
}): Promise<CronScriptResult> {
    const timeoutMs = input.timeoutMs ?? cronScriptLimits.timeoutMs;
    const stdout = createCappedBuffer(input.maxStdoutBytes ?? cronScriptLimits.maxStdoutBytes);
    const stderr = createCappedBuffer(input.maxStderrBytes ?? cronScriptLimits.maxStderrBytes);

    return new Promise((resolve, reject) => {
        const child = spawn('sh', ['-c', input.command], {
            cwd: input.cwd,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            child.kill('SIGKILL');
        }, timeoutMs);

        child.stdout.on('data', (chunk: Buffer) => stdout.append(chunk));
        child.stderr.on('data', (chunk: Buffer) => stderr.append(chunk));
        child.on('error', (error) => {
            clearTimeout(timer);
            reject(new Error(`Script failed to start: ${error.message}`));
        });
        child.on('close', (exitCode) => {
            clearTimeout(timer);
            resolve({
                exitCode,
                stderr: stderr.read(),
                stdout: stdout.read(),
                timedOut,
            });
        });
    });
}

const truncationMarker = '\n…[output truncated]';

function createCappedBuffer(maxBytes: number) {
    const chunks: Buffer[] = [];
    let size = 0;
    let truncated = false;
    return {
        append(chunk: Buffer) {
            if (size >= maxBytes) {
                truncated = true;
                return;
            }
            const remaining = maxBytes - size;
            if (chunk.length > remaining) {
                chunks.push(chunk.subarray(0, remaining));
                size = maxBytes;
                truncated = true;
                return;
            }
            chunks.push(chunk);
            size += chunk.length;
        },
        read() {
            const text = Buffer.concat(chunks).toString('utf8');
            return truncated ? `${text}${truncationMarker}` : text;
        },
    };
}
