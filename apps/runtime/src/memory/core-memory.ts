import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getStoredAgent } from '../tavern/agents-store.ts';

export const agentCoreMemoryFileNames = ['USER.md', 'MEMORY.md'] as const;
export type AgentCoreMemoryFileName = (typeof agentCoreMemoryFileNames)[number];

export interface AgentCoreMemorySnapshot {
    content: string;
    hash: string;
    name: AgentCoreMemoryFileName;
}

export interface AgentCoreMemoryFileChange {
    afterHash: string;
    beforeHash: string | null;
    path: string;
}

export async function readAgentCoreMemoryFile(input: {
    agentId: string;
    name: AgentCoreMemoryFileName;
}): Promise<AgentCoreMemorySnapshot> {
    const filePath = coreMemoryFilePath(input.agentId, input.name);
    const content = await fs.readFile(filePath, 'utf8').catch((error) => {
        if (isNotFoundError(error)) {
            return '';
        }
        throw error;
    });
    return { content, hash: sha256(content), name: input.name };
}

export async function writeAgentCoreMemoryFile(input: {
    agentId: string;
    content: string;
    expectedHash: string;
    name: AgentCoreMemoryFileName;
}): Promise<AgentCoreMemoryFileChange> {
    const filePath = coreMemoryFilePath(input.agentId, input.name);
    const previous = await fs.readFile(filePath, 'utf8').catch((error) => {
        if (isNotFoundError(error)) {
            return '';
        }
        throw error;
    });
    const beforeHash = sha256(previous);
    if (beforeHash !== input.expectedHash) {
        throw new Error(`${input.name} changed since it was read.`);
    }

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, input.content, { mode: 0o600 });
    return {
        afterHash: sha256(input.content),
        beforeHash: previous ? beforeHash : null,
        path: input.name,
    };
}

function coreMemoryFilePath(agentId: string, name: AgentCoreMemoryFileName) {
    const agent = getStoredAgent(agentId);
    if (!agent) {
        throw new Error(`Agent "${agentId}" does not exist.`);
    }
    return path.join(agent.workspaceFolder, name);
}

function sha256(value: string) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function isNotFoundError(error: unknown) {
    return Boolean(
        error &&
            typeof error === 'object' &&
            'code' in error &&
            (error as { code?: unknown }).code === 'ENOENT'
    );
}
