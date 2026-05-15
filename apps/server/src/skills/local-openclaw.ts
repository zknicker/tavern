import { constants as fsConstants } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AgentProjection } from '../storage/agents.ts';

export function getOpenClawHome() {
    return path.join(os.homedir(), '.openclaw');
}

export async function assertLocalOpenClawHome() {
    await assertWritableDirectory(getOpenClawHome(), 'OpenClaw home');
}

export async function assertLocalOpenClawWorkspace(agent: AgentProjection) {
    await assertLocalOpenClawHome();

    const workspace = agent.workspaceFolder?.trim();
    await assertLocalOpenClawWorkspacePath({
        label: `OpenClaw agent "${agent.id}" workspace`,
        workspace,
    });

    return workspace as string;
}

export async function assertLocalOpenClawWorkspacePath(input: {
    label: string;
    workspace: null | string | undefined;
}) {
    const workspace = input.workspace?.trim();
    if (!(workspace && path.isAbsolute(workspace))) {
        throw new Error(`${input.label} must be a local absolute path.`);
    }

    await assertWritableDirectory(workspace, input.label);
    return workspace;
}

async function assertWritableDirectory(directory: string, label: string) {
    try {
        const stat = await fs.stat(directory);
        if (!stat.isDirectory()) {
            throw new Error(`${label} is not a directory: ${directory}`);
        }
        await fs.access(directory, fsConstants.R_OK | fsConstants.W_OK);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
            `${label} must be writable from Tavern Runtime on this host: ${directory}. ${message}`
        );
    }
}
