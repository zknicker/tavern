import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultCortexPageTypes } from '@tavern/api';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { publishRuntimeEvent } from '../tavern/runtime-events.ts';

export interface AgentInstructionSource {
    agentId: string;
    agentName: string;
    updatedAt: string;
    userInstructions: string;
    workspaceDir: string;
}

export interface AgentInstructionRenderResult {
    content: string;
    files: AgentWorkspaceRenderedFile[];
    renderedAt: string;
    sha256: string;
}

export interface AgentWorkspaceRenderedFile {
    content: string;
    path: string;
    sha256: string;
}

export interface AgentInstructionReadResult {
    agentId: string;
    content: string;
    path: string;
    renderedAt: string | null;
    sha256: string | null;
    updatedAt: string | null;
}

export const generatedInstructionFileName = 'AGENTS.md';
export const generatedWorkspaceFileNames = [
    'AGENTS.md',
    'SOUL.md',
    'TOOLS.md',
    'IDENTITY.md',
    'USER.md',
] as const;
export const openClawBootstrapFileNamesToClear = [
    'BOOTSTRAP.md',
    'HEARTBEAT.md',
    'MEMORY.md',
    'ROLE.md',
] as const;

const defaultAgentName = 'main';
const defaultAgentId = 'main';
const seedDefaultsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'seed-defaults');

export function ensureWorkspaceInstructionSchema(db: Database) {
    db.exec(`
CREATE TABLE IF NOT EXISTS workspace_agent_instructions (
  agent_id TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL,
  workspace_dir TEXT NOT NULL,
  user_instructions TEXT NOT NULL DEFAULT '',
  rendered_hash TEXT,
  rendered_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`);
    try {
        db.exec(
            'ALTER TABLE workspace_agent_instructions RENAME COLUMN soul TO user_instructions;'
        );
    } catch {
        /* column already migrated or table is fresh */
    }
    try {
        db.exec(
            `ALTER TABLE workspace_agent_instructions ADD COLUMN user_instructions TEXT NOT NULL DEFAULT '';`
        );
    } catch {
        /* column already exists */
    }
}

export function getAgentInstructionSource(
    db: Database,
    agentId: string
): AgentInstructionSource | null {
    const row = db
        .prepare(
            `SELECT agent_id, agent_name, workspace_dir, user_instructions, updated_at
             FROM workspace_agent_instructions
             WHERE agent_id = ?`
        )
        .get(agentId) as
        | {
              agent_id: string;
              agent_name: string;
              updated_at: string;
              user_instructions: string;
              workspace_dir: string;
          }
        | undefined;

    return row
        ? {
              agentId: row.agent_id,
              agentName: row.agent_name,
              updatedAt: row.updated_at,
              userInstructions: row.user_instructions,
              workspaceDir: row.workspace_dir,
          }
        : null;
}

export function updateAgentInstructionSource(
    db: Database,
    input: {
        agentId?: string | null;
        agentName?: string | null;
        userInstructions?: string | null;
        workspaceDir: string;
    }
) {
    const timestamp = new Date().toISOString();
    const existing = getAgentInstructionSource(db, input.agentId ?? defaultAgentId);
    const userInstructions =
        input.userInstructions === undefined
            ? (existing?.userInstructions ?? '')
            : (input.userInstructions?.trim() ?? existing?.userInstructions ?? '');
    const source = {
        agentId: input.agentId?.trim() || defaultAgentId,
        agentName: input.agentName?.trim() || existing?.agentName || defaultAgentName,
        userInstructions,
        workspaceDir: input.workspaceDir,
    };

    db.prepare(
        `INSERT INTO workspace_agent_instructions (
            agent_id, agent_name, workspace_dir, user_instructions, created_at, updated_at
        ) VALUES (
            $agentId, $agentName, $workspaceDir, $userInstructions, $timestamp, $timestamp
        )
        ON CONFLICT(agent_id) DO UPDATE SET
            agent_name = excluded.agent_name,
            workspace_dir = excluded.workspace_dir,
            user_instructions = excluded.user_instructions,
            updated_at = excluded.updated_at`
    ).run(
        namedParams({
            agentId: source.agentId,
            agentName: source.agentName,
            timestamp,
            userInstructions: source.userInstructions,
            workspaceDir: source.workspaceDir,
        })
    );

    return getAgentInstructionSource(db, source.agentId) as AgentInstructionSource;
}

export async function renderAgentInstructions(
    db: Database,
    agentId = defaultAgentId,
    options: { overwrite?: boolean } = {}
) {
    const source = getAgentInstructionSource(db, agentId);

    if (!source) {
        throw new Error(`No managed workspace is registered for agent "${agentId}".`);
    }

    const renderedAt = new Date().toISOString();
    const files = await composeAgentWorkspaceFiles(source);
    const agentsFile = files.find((file) => file.path === generatedInstructionFileName);
    if (!agentsFile) {
        throw new Error('Generated workspace instructions are missing AGENTS.md.');
    }
    await fs.mkdir(source.workspaceDir, { recursive: true });
    await clearOpenClawBootstrapFiles(source.workspaceDir);
    await Promise.all(files.map((file) => writeWorkspaceFile(source.workspaceDir, file, options)));
    const content = await fs.readFile(
        path.join(source.workspaceDir, generatedInstructionFileName),
        {
            encoding: 'utf8',
        }
    );
    const sha256 = await hashText(content);
    const renderedFiles = files.map((file) =>
        file.path === generatedInstructionFileName ? { ...file, content, sha256 } : file
    );
    db.prepare(
        `UPDATE workspace_agent_instructions
         SET rendered_at = $renderedAt, rendered_hash = $sha256, updated_at = $renderedAt
         WHERE agent_id = $agentId`
    ).run(namedParams({ agentId: source.agentId, renderedAt, sha256 }));
    publishRuntimeEvent({
        agentId: source.agentId,
        path: generatedInstructionFileName,
        renderedAt,
        sha256,
        timestamp: renderedAt,
        type: 'workspace.instructions.updated',
    });

    return {
        content,
        files: renderedFiles,
        renderedAt,
        sha256,
    } satisfies AgentInstructionRenderResult;
}

export async function readRenderedAgentInstructions(db: Database, agentId = defaultAgentId) {
    const row = db
        .prepare(
            `SELECT agent_id, workspace_dir, rendered_at, rendered_hash, updated_at
             FROM workspace_agent_instructions
             WHERE agent_id = ?`
        )
        .get(agentId) as
        | {
              agent_id: string;
              rendered_at: string | null;
              rendered_hash: string | null;
              updated_at: string | null;
              workspace_dir: string;
          }
        | undefined;

    if (!row) {
        throw new Error(`No managed workspace is registered for agent "${agentId}".`);
    }

    return {
        agentId: row.agent_id,
        content: await fs.readFile(path.join(row.workspace_dir, generatedInstructionFileName), {
            encoding: 'utf8',
        }),
        path: generatedInstructionFileName,
        renderedAt: row.rendered_at,
        sha256: row.rendered_hash,
        updatedAt: row.updated_at,
    } satisfies AgentInstructionReadResult;
}

export async function clearOpenClawBootstrapFiles(workspaceDir: string) {
    await Promise.all(
        openClawBootstrapFileNamesToClear.map((fileName) =>
            fs.writeFile(path.join(workspaceDir, fileName), '', { mode: 0o600 })
        )
    );
}

export async function composeAgentWorkspaceFiles(
    source: Pick<AgentInstructionSource, 'agentName' | 'userInstructions'>
) {
    const definitions = [
        {
            content: await composeAgentInstructions(source),
            path: 'AGENTS.md',
        },
        {
            content: await composeAgentSoul(source),
            path: 'SOUL.md',
        },
        {
            content: await composeAgentTools(),
            path: 'TOOLS.md',
        },
        {
            content: await composeAgentIdentity(source),
            path: 'IDENTITY.md',
        },
        {
            content: await composeAgentUser(),
            path: 'USER.md',
        },
    ];

    return Promise.all(
        definitions.map(async (file) => ({
            ...file,
            sha256: await hashText(file.content),
        }))
    );
}

export function composeAgentInstructions(
    source: Pick<AgentInstructionSource, 'agentName' | 'userInstructions'>
) {
    return renderMarkdownSeed('agents.md', {
        agentName: source.agentName,
        defaultCortexPageTypes: defaultCortexPageTypes.join(', '),
    });
}

function composeAgentSoul(source: Pick<AgentInstructionSource, 'agentName'>) {
    return renderMarkdownSeed('soul.md', {
        agentName: source.agentName,
    });
}

function composeAgentTools() {
    return renderMarkdownSeed('tools.md', {});
}

function composeAgentIdentity(source: Pick<AgentInstructionSource, 'agentName'>) {
    return renderMarkdownSeed('identity.md', {
        agentName: source.agentName,
    });
}

function composeAgentUser() {
    return renderMarkdownSeed('user.md', {});
}

async function renderMarkdownSeed(fileName: string, values: Record<string, string | null>) {
    const template = await fs.readFile(path.join(seedDefaultsDir, fileName), 'utf8');
    const content = template
        .replace(/\{\{([a-zA-Z0-9_]+)\}\}/gu, (match, key: string) => {
            if (!(key in values)) {
                return match;
            }
            return values[key] ?? '';
        })
        .replace(/\n{3,}/gu, '\n\n')
        .trimEnd();
    const unresolved = content.match(/\{\{[a-zA-Z0-9_]+\}\}/u);
    if (unresolved) {
        throw new Error(`Unresolved placeholder ${unresolved[0]} in ${fileName}.`);
    }
    return `${content}\n`;
}

async function writeWorkspaceFile(
    workspaceDir: string,
    file: AgentWorkspaceRenderedFile,
    options: { overwrite?: boolean }
) {
    const filePath = path.join(workspaceDir, file.path);
    if (!(await shouldWriteWorkspaceFile(filePath, options))) {
        return;
    }
    await fs.writeFile(filePath, file.content, { mode: 0o600 });
}

async function shouldWriteWorkspaceFile(filePath: string, options: { overwrite?: boolean }) {
    if (options.overwrite) {
        return true;
    }
    try {
        const existing = await fs.readFile(filePath, 'utf8');
        return (
            existing.includes('This file is generated by Tavern.') ||
            existing.includes('workspace notes tools')
        );
    } catch {
        return true;
    }
}

async function hashText(value: string) {
    const data = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
