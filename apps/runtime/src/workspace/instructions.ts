import fs from 'node:fs/promises';
import path from 'node:path';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { publishRuntimeEvent } from '../tavern/runtime-events.ts';
import {
    agentNotesFileName,
    agentWorkDirectoryName,
    renderAgentInstructions,
    renderSeededNotes,
} from './managed-instructions.ts';

export interface AgentWorkspaceSource {
    agentId: string;
    agentName: string;
    updatedAt: string;
    workspaceDir: string;
}

export interface AgentInstructionGenerateResult {
    content: string;
    renderedAt: string;
    sha256: string;
    written: boolean;
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
export const hermesBootstrapFileNamesToClear = [
    'BOOTSTRAP.md',
    'HEARTBEAT.md',
    'IDENTITY.md',
    'MEMORY.md',
    'ROLE.md',
    'TOOLS.md',
    'USER.md',
] as const;

const defaultAgentId = 'main';
const defaultAgentName = 'main';
// One marker pair per legacy file; used only to migrate pre-generated installs.
const legacyManagedBlockPattern =
    /<!-- tavern:managed v=[a-f0-9]{16} -->[\s\S]*?<!-- \/tavern:managed -->/u;
const legacyUserContentHint =
    '<!-- Everything below is yours. Add durable instructions and notes here; Tavern only rewrites the managed block above. -->';

export function getAgentWorkspaceSource(
    db: Database,
    agentId: string
): AgentWorkspaceSource | null {
    const row = db
        .prepare(
            `SELECT agent_id, agent_name, workspace_dir, updated_at
             FROM workspace_agent_instructions
             WHERE agent_id = ?`
        )
        .get(agentId) as
        | {
              agent_id: string;
              agent_name: string;
              updated_at: string;
              workspace_dir: string;
          }
        | undefined;

    return row
        ? {
              agentId: row.agent_id,
              agentName: row.agent_name,
              updatedAt: row.updated_at,
              workspaceDir: row.workspace_dir,
          }
        : null;
}

export function registerAgentWorkspace(
    db: Database,
    input: {
        agentId?: string | null;
        agentName?: string | null;
        workspaceDir: string;
    }
) {
    const timestamp = new Date().toISOString();
    const agentId = input.agentId?.trim() || defaultAgentId;
    const existing = getAgentWorkspaceSource(db, agentId);
    const agentName = input.agentName?.trim() || existing?.agentName || defaultAgentName;

    db.prepare(
        `INSERT INTO workspace_agent_instructions (
            agent_id, agent_name, workspace_dir, created_at, updated_at
        ) VALUES (
            $agentId, $agentName, $workspaceDir, $timestamp, $timestamp
        )
        ON CONFLICT(agent_id) DO UPDATE SET
            agent_name = excluded.agent_name,
            workspace_dir = excluded.workspace_dir,
            updated_at = excluded.updated_at`
    ).run(
        namedParams({
            agentId,
            agentName,
            timestamp,
            workspaceDir: input.workspaceDir,
        })
    );

    return getAgentWorkspaceSource(db, agentId) as AgentWorkspaceSource;
}

/**
 * Generate AGENTS.md from its sources. AGENTS.md is a pure artifact with
 * Tavern as its single writer: it is composed deterministically from the
 * managed content, the agent name, and NOTES.md, written read-only, and only
 * rewritten when the composed bytes change. NOTES.md is seeded once (migrating
 * any pre-generated AGENTS.md content) and never written by Tavern again.
 */
export async function generateAgentInstructions(db: Database, agentId = defaultAgentId) {
    const source = getAgentWorkspaceSource(db, agentId);

    if (!source) {
        throw new Error(`No managed workspace is registered for agent "${agentId}".`);
    }

    const agentsPath = path.join(source.workspaceDir, generatedInstructionFileName);
    const notes = await ensureAgentNotes(source.workspaceDir, agentsPath);
    await ensureAgentWorkDirectory(source.workspaceDir);
    const next = renderAgentInstructions(source.agentName, notes);
    const existing = await fs.readFile(agentsPath, 'utf8').catch(() => null);
    const written = next !== existing;

    if (written) {
        await fs.mkdir(source.workspaceDir, { recursive: true });
        await writeReadOnlyFile(agentsPath, next);
        await clearHermesBootstrapFiles(source.workspaceDir);
    }

    const renderedAt = new Date().toISOString();
    const sha256 = await hashText(next);
    db.prepare(
        `UPDATE workspace_agent_instructions
         SET rendered_at = $renderedAt, rendered_hash = $sha256, updated_at = $renderedAt
         WHERE agent_id = $agentId`
    ).run(namedParams({ agentId: source.agentId, renderedAt, sha256 }));

    if (written) {
        publishRuntimeEvent({
            agentId: source.agentId,
            path: generatedInstructionFileName,
            renderedAt,
            sha256,
            timestamp: renderedAt,
            type: 'workspace.instructions.updated',
        });
    }

    return { content: next, renderedAt, sha256, written } satisfies AgentInstructionGenerateResult;
}

/**
 * Generate for callers that cannot assume the agent has a registered managed
 * workspace. Returns null when unregistered.
 */
export async function generateRegisteredAgentInstructions(db: Database, agentId: string) {
    return getAgentWorkspaceSource(db, agentId)
        ? await generateAgentInstructions(db, agentId)
        : null;
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

export async function clearHermesBootstrapFiles(workspaceDir: string) {
    await Promise.all(
        hermesBootstrapFileNamesToClear.map((fileName) =>
            fs.writeFile(path.join(workspaceDir, fileName), '', { mode: 0o600 })
        )
    );
}

/**
 * Read NOTES.md, seeding it on first run. Seeding migrates the user/agent
 * content of a pre-generated AGENTS.md (everything outside the legacy managed
 * block) so nothing is lost when an install moves to the generated layout.
 */
async function ensureAgentNotes(workspaceDir: string, agentsPath: string) {
    const notesPath = path.join(workspaceDir, agentNotesFileName);
    const existing = await fs.readFile(notesPath, 'utf8').catch(() => null);

    if (existing !== null) {
        return existing;
    }

    const seed = (await migrateLegacyAgentsContent(agentsPath)) ?? renderSeededNotes();
    await fs.mkdir(workspaceDir, { recursive: true });
    await fs.writeFile(notesPath, seed, { mode: 0o600 });
    return seed;
}

async function ensureAgentWorkDirectory(workspaceDir: string) {
    await fs.mkdir(path.join(workspaceDir, agentWorkDirectoryName), { recursive: true });
}

async function migrateLegacyAgentsContent(agentsPath: string) {
    const legacy = await fs.readFile(agentsPath, 'utf8').catch(() => null);

    if (legacy === null || legacy.startsWith('<!-- GENERATED BY TAVERN')) {
        return null;
    }

    const remainder = legacy
        .replace(legacyManagedBlockPattern, '')
        .replace(legacyUserContentHint, '')
        .trim();

    return remainder.length > 0 ? `${remainder}\n` : null;
}

/** AGENTS.md is immutable to everyone but Tavern: written read-only. */
async function writeReadOnlyFile(filePath: string, content: string) {
    await fs.rm(filePath, { force: true });
    await fs.writeFile(filePath, content, { mode: 0o444 });
}

async function hashText(value: string) {
    const data = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
