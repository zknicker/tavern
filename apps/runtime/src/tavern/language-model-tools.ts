import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { type ToolSet, tool } from 'ai';
import * as z from 'zod';

const execFileAsync = promisify(execFile);
const commandTimeoutMs = 30_000;
const maxCommandBuffer = 1024 * 1024;

export function createLanguageModelTools(input: { workspaceFolder: string }): ToolSet {
    const workspaceFolder = path.resolve(input.workspaceFolder);

    return {
        bash: tool({
            description: 'Run a shell command in the agent workspace.',
            inputSchema: z.object({
                command: z.string().min(1),
                workdir: z.string().optional(),
            }),
            execute: async ({ command, workdir }) => {
                const cwd = resolveWorkspacePath(workspaceFolder, workdir ?? '.');
                await fs.mkdir(cwd, { recursive: true });
                try {
                    const { stderr, stdout } = await execFileAsync('bash', ['-lc', command], {
                        cwd,
                        maxBuffer: maxCommandBuffer,
                        timeout: commandTimeoutMs,
                    });
                    return {
                        cwd,
                        exitCode: 0,
                        stderr,
                        stdout,
                    };
                } catch (error) {
                    const failure = error as {
                        code?: number | string;
                        killed?: boolean;
                        signal?: string;
                        stderr?: string;
                        stdout?: string;
                    };
                    return {
                        cwd,
                        exitCode: typeof failure.code === 'number' ? failure.code : 1,
                        killed: Boolean(failure.killed),
                        signal: failure.signal ?? null,
                        stderr: failure.stderr ?? '',
                        stdout: failure.stdout ?? '',
                    };
                }
            },
        }),
        read_file: tool({
            description: 'Read a UTF-8 file from the agent workspace.',
            inputSchema: z.object({
                path: z.string().min(1),
            }),
            execute: async (input) => {
                const filePath = resolveWorkspacePath(workspaceFolder, input.path);
                const content = await fs.readFile(filePath, 'utf8');
                return {
                    content,
                    path: filePath,
                };
            },
        }),
    };
}

function resolveWorkspacePath(workspaceFolder: string, requestedPath: string) {
    const resolvedPath = path.isAbsolute(requestedPath)
        ? path.resolve(requestedPath)
        : path.resolve(workspaceFolder, requestedPath);

    if (
        resolvedPath !== workspaceFolder &&
        !resolvedPath.startsWith(`${workspaceFolder}${path.sep}`)
    ) {
        throw new Error(`Path is outside the agent workspace: ${requestedPath}`);
    }

    return resolvedPath;
}
