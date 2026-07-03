import fs from 'node:fs/promises';
import path from 'node:path';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { isMemoryEnabled } from '../memory/settings.ts';
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
    renderedAt: string | null;
    sha256: string | null;
    updatedAt: string | null;
}

const defaultAgentId = 'main';
const defaultAgentName = 'main';

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
 * Generate the agent system prompt from its editable workspace sources.
 * Tavern composes this deterministically from managed content, the agent name,
 * and NOTES.md. NOTES.md is seeded once and never written by Tavern again.
 */
export async function generateAgentInstructions(db: Database, agentId = defaultAgentId) {
    const source = getAgentWorkspaceSource(db, agentId);

    if (!source) {
        throw new Error(`No managed workspace is registered for agent "${agentId}".`);
    }

    const notes = await ensureAgentNotes(source.workspaceDir);
    await ensureAgentWorkDirectory(source.workspaceDir);
    await removeGeneratedInstructionFile(source.workspaceDir);
    const next = renderAgentInstructions(source.agentName, notes, {
        memoryEnabled: isMemoryEnabled(),
    });
    const previousHash = readRenderedInstructionHash(db, source.agentId);
    const renderedAt = new Date().toISOString();
    const sha256 = await hashText(next);
    const written = sha256 !== previousHash;

    db.prepare(
        `UPDATE workspace_agent_instructions
         SET rendered_at = $renderedAt, rendered_hash = $sha256, updated_at = $renderedAt
         WHERE agent_id = $agentId`
    ).run(namedParams({ agentId: source.agentId, renderedAt, sha256 }));

    if (written) {
        publishRuntimeEvent({
            agentId: source.agentId,
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
    const generated = await generateAgentInstructions(db, agentId);
    const source = getAgentWorkspaceSource(db, agentId);
    return {
        agentId,
        content: generated.content,
        renderedAt: generated.renderedAt,
        sha256: generated.sha256,
        updatedAt: source?.updatedAt ?? null,
    } satisfies AgentInstructionReadResult;
}

async function ensureAgentNotes(workspaceDir: string) {
    const notesPath = path.join(workspaceDir, agentNotesFileName);
    const existing = await fs.readFile(notesPath, 'utf8').catch(() => null);

    if (existing !== null) {
        return existing;
    }

    const seed = renderSeededNotes();
    await fs.mkdir(workspaceDir, { recursive: true });
    await fs.writeFile(notesPath, seed, { mode: 0o600 });
    return seed;
}

async function ensureAgentWorkDirectory(workspaceDir: string) {
    await fs.mkdir(path.join(workspaceDir, agentWorkDirectoryName), { recursive: true });
}

async function removeGeneratedInstructionFile(workspaceDir: string) {
    await fs.rm(path.join(workspaceDir, 'AGENTS.md'), { force: true });
}

async function hashText(value: string) {
    const data = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function readRenderedInstructionHash(db: Database, agentId: string) {
    const row = db
        .prepare(
            `SELECT rendered_hash
             FROM workspace_agent_instructions
             WHERE agent_id = ?`
        )
        .get(agentId) as { rendered_hash: string | null } | undefined;
    return row?.rendered_hash ?? null;
}
