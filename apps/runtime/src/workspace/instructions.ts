import fs from 'node:fs/promises';
import path from 'node:path';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { publishRuntimeEvent } from '../tavern/runtime-events.ts';

export interface AgentInstructionSource {
    agentId: string;
    agentName: string;
    notes: string;
    updatedAt: string;
    userInstructions: string;
    workspaceDir: string;
}

export interface AgentInstructionRenderResult {
    content: string;
    renderedAt: string;
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
export const hermesBootstrapFileNamesToClear = [
    'BOOTSTRAP.md',
    'HEARTBEAT.md',
    'IDENTITY.md',
    'MEMORY.md',
    'ROLE.md',
    'TOOLS.md',
    'USER.md',
] as const;

const defaultAgentName = 'main';
const defaultAgentId = 'main';

const tavernManagedInstructions = `## Delegation

Work inline for quick, narrow, real-time tasks.

Use subagents for isolated context: broad exploration, parallel research, independent review, or work that would flood the main thread with logs/search/files.

Give subagents a clear goal, context, constraints, and output shape. Synthesize results before replying.

Do not delegate simple lookups, small edits, or work whose reasoning must stay visible.

## Cortex

Cortex is Tavern's browser for the llm-wiki hub. The wiki is plain Markdown owned by the user. Use it when prior project context, research, source-backed notes, outputs, or durable user preferences could change the answer. Current user instructions and current source material win.

### llm-wiki

Prefer the installed \`wiki\` skill for wiki work. In managed Hermes, use the
skill directly for requests such as:

- research a topic and compile findings
- ingest a source
- query existing wiki knowledge
- compile new articles from raw sources
- audit an output or article
- write a report, plan, catalog, or other output

The hub resolves from \`TAVERN_WIKI_HUB_PATH\`, then \`~/.config/llm-wiki/config.json\`, then Tavern's managed Runtime wiki hub. Topic wikis live under \`topics/<slug>/\`; archived topics live under \`topics/.archive/<slug>/\`.

Keep llm-wiki's structure:

- \`raw/\` contains immutable source material.
- \`wiki/\` contains compiled articles.
- \`inventory/\` and \`datasets/\` track durable records and external data manifests.
- \`output/\` contains reports, plans, decks, catalogs, and generated artifacts.
- \`_index.md\`, \`config.md\`, and \`log.md\` keep each topic navigable.

### Routing

For quick answers, read/search the wiki first. For research, ingestion, compilation, audit, librarian, lessons, or generated outputs, route through llm-wiki. Do not recreate those workflows with ad hoc files.

### Conflicts

Priority: current user statement > current source material > compiled wiki article > raw source notes > older outputs.

### Writes

Preserve provenance. Put sources in \`raw/\`, synthesize in \`wiki/\`, and file deliverables in \`output/\`. Do not mutate raw source files after ingestion. Do not save secrets or broad chat dumps into the wiki without explicit user direction.

Use Tasks or Runtime crons for scheduled wiki work. Do not invent hidden background Cortex maintenance.

This AGENTS.md file was seeded by Tavern. Edit it in Tavern settings to update managed workspace instructions. To update agent-authored durable operating notes, use the Tavern workspace notes tools.`;

export function ensureWorkspaceInstructionSchema(db: Database) {
    db.exec(`
CREATE TABLE IF NOT EXISTS workspace_agent_instructions (
  agent_id TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL,
  workspace_dir TEXT NOT NULL,
  user_instructions TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
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
    try {
        db.exec(
            `ALTER TABLE workspace_agent_instructions ADD COLUMN notes TEXT NOT NULL DEFAULT '';`
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
            `SELECT agent_id, agent_name, workspace_dir, user_instructions, notes, updated_at
             FROM workspace_agent_instructions
             WHERE agent_id = ?`
        )
        .get(agentId) as
        | {
              agent_id: string;
              agent_name: string;
              notes: string;
              updated_at: string;
              user_instructions: string;
              workspace_dir: string;
          }
        | undefined;

    return row
        ? {
              agentId: row.agent_id,
              agentName: row.agent_name,
              notes: row.notes,
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
        notes: existing?.notes ?? '',
        userInstructions,
        workspaceDir: input.workspaceDir,
    };

    db.prepare(
        `INSERT INTO workspace_agent_instructions (
            agent_id, agent_name, workspace_dir, user_instructions, notes, created_at, updated_at
        ) VALUES (
            $agentId, $agentName, $workspaceDir, $userInstructions, $notes, $timestamp, $timestamp
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
            notes: source.notes,
            timestamp,
            userInstructions: source.userInstructions,
            workspaceDir: source.workspaceDir,
        })
    );

    return getAgentInstructionSource(db, source.agentId) as AgentInstructionSource;
}

export function updateAgentNotes(
    db: Database,
    input: {
        agentId?: string | null;
        notes: string;
        workspaceDir?: string | null;
    }
) {
    const timestamp = new Date().toISOString();
    const agentId = input.agentId?.trim() || defaultAgentId;
    const existing = getAgentInstructionSource(db, agentId);
    const workspaceDir = input.workspaceDir?.trim() || existing?.workspaceDir;

    if (!workspaceDir) {
        throw new Error(`No managed workspace is registered for agent "${agentId}".`);
    }

    db.prepare(
        `INSERT INTO workspace_agent_instructions (
            agent_id, agent_name, workspace_dir, user_instructions, notes, created_at, updated_at
        ) VALUES (
            $agentId, $agentName, $workspaceDir, $userInstructions, $notes, $timestamp, $timestamp
        )
        ON CONFLICT(agent_id) DO UPDATE SET
            notes = excluded.notes,
            updated_at = excluded.updated_at`
    ).run(
        namedParams({
            agentId,
            agentName: existing?.agentName ?? defaultAgentName,
            notes: normalizeNotes(input.notes),
            timestamp,
            userInstructions: existing?.userInstructions ?? '',
            workspaceDir,
        })
    );

    return getAgentInstructionSource(db, agentId) as AgentInstructionSource;
}

export async function renderAgentInstructions(db: Database, agentId = defaultAgentId) {
    const source = getAgentInstructionSource(db, agentId);

    if (!source) {
        throw new Error(`No managed workspace is registered for agent "${agentId}".`);
    }

    const renderedAt = new Date().toISOString();
    const content = composeAgentInstructions(source);
    const sha256 = await hashText(content);
    const agentsPath = path.join(source.workspaceDir, generatedInstructionFileName);

    await fs.mkdir(source.workspaceDir, { recursive: true });
    await fs.writeFile(agentsPath, content, { mode: 0o600 });
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

    return { content, renderedAt, sha256 } satisfies AgentInstructionRenderResult;
}

export async function ensureAgentInstructionsFile(db: Database, agentId = defaultAgentId) {
    const source = getAgentInstructionSource(db, agentId);

    if (!source) {
        throw new Error(`No managed workspace is registered for agent "${agentId}".`);
    }

    const agentsPath = path.join(source.workspaceDir, generatedInstructionFileName);
    try {
        const [content, stats] = await Promise.all([
            fs.readFile(agentsPath, 'utf8'),
            fs.stat(agentsPath),
        ]);
        const renderedAt = stats.mtime.toISOString();
        const sha256 = await hashText(content);
        db.prepare(
            `UPDATE workspace_agent_instructions
             SET rendered_at = $renderedAt, rendered_hash = $sha256
             WHERE agent_id = $agentId`
        ).run(namedParams({ agentId: source.agentId, renderedAt, sha256 }));

        return { content, renderedAt, sha256 } satisfies AgentInstructionRenderResult;
    } catch {
        return await renderAgentInstructions(db, agentId);
    }
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

export function composeAgentInstructions(
    source: Pick<AgentInstructionSource, 'agentName' | 'notes' | 'userInstructions'>
) {
    const sections = [
        '# Tavern Agent Instructions',
        `You are ${source.agentName}, a Tavern-managed agent inside the Tavern chat app.`,
        tavernManagedInstructions,
        formatOptionalParagraph(source.userInstructions),
        formatOptionalParagraph(source.notes),
    ].filter((section): section is string => Boolean(section));

    return `${sections.join('\n\n')}\n`;
}

function formatOptionalParagraph(value: string) {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
}

function normalizeNotes(value: string) {
    return value.trim().slice(0, 20_000);
}

async function hashText(value: string) {
    const data = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
