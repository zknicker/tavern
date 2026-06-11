import fs from 'node:fs/promises';
import path from 'node:path';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { publishRuntimeEvent } from '../tavern/runtime-events.ts';
import { renderManagedInstructionContent } from './managed-instructions.ts';

export interface AgentWorkspaceSource {
    agentId: string;
    agentName: string;
    updatedAt: string;
    workspaceDir: string;
}

export interface AgentInstructionReconcileResult {
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

export const managedBlockEndMarker = '<!-- /tavern:managed -->';

const defaultAgentId = 'main';
const defaultAgentName = 'main';
const managedBlockStartPattern = /<!-- tavern:managed v=[a-f0-9]{16} -->/u;
const userContentHint =
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
 * Reconcile the Tavern-managed block inside the agent's AGENTS.md.
 *
 * Only the managed block is Tavern's write surface: a missing file is seeded,
 * a stale block is replaced in place, and missing markers re-insert the block
 * at the top. All content outside the markers is preserved byte-for-byte.
 */
export async function reconcileAgentInstructions(db: Database, agentId = defaultAgentId) {
    const source = getAgentWorkspaceSource(db, agentId);

    if (!source) {
        throw new Error(`No managed workspace is registered for agent "${agentId}".`);
    }

    const block = await renderManagedInstructionBlock(source.agentName);
    const agentsPath = path.join(source.workspaceDir, generatedInstructionFileName);
    const existing = await fs.readFile(agentsPath, 'utf8').catch(() => null);
    const next =
        existing === null ? `${block}\n\n${userContentHint}\n` : applyManagedBlock(existing, block);
    const written = next !== existing;

    if (written) {
        await fs.mkdir(source.workspaceDir, { recursive: true });
        await fs.writeFile(agentsPath, next, { mode: 0o600 });
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

    return { content: next, renderedAt, sha256, written } satisfies AgentInstructionReconcileResult;
}

/**
 * Reconcile for callers that cannot assume the agent has a registered managed
 * workspace (file saves, turn dispatch). Returns null when unregistered.
 */
export async function reconcileRegisteredAgentInstructions(db: Database, agentId: string) {
    return getAgentWorkspaceSource(db, agentId)
        ? await reconcileAgentInstructions(db, agentId)
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

export async function renderManagedInstructionBlock(agentName: string) {
    const content = renderManagedInstructionContent(agentName);
    const version = (await hashText(content)).slice(0, 16);

    return `<!-- tavern:managed v=${version} -->\n${content}\n${managedBlockEndMarker}`;
}

export async function clearHermesBootstrapFiles(workspaceDir: string) {
    await Promise.all(
        hermesBootstrapFileNamesToClear.map((fileName) =>
            fs.writeFile(path.join(workspaceDir, fileName), '', { mode: 0o600 })
        )
    );
}

function applyManagedBlock(existing: string, block: string) {
    const startMatch = managedBlockStartPattern.exec(existing);

    if (startMatch) {
        const blockStart = startMatch.index;
        const endIndex = existing.indexOf(managedBlockEndMarker, blockStart);

        if (endIndex >= 0) {
            if (existing.startsWith(block, blockStart)) {
                return existing;
            }
            const blockEnd = endIndex + managedBlockEndMarker.length;
            return `${existing.slice(0, blockStart)}${block}${existing.slice(blockEnd)}`;
        }
    }

    return `${block}\n\n${existing}`;
}

async function hashText(value: string) {
    const data = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
