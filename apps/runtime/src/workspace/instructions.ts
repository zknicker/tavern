import fs from 'node:fs/promises';
import path from 'node:path';
import { defaultCortexPageTypes } from '@tavern/api';
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
    'SOUL.md',
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

Cortex is Tavern's durable knowledgebase and memory. Use it when prior project context, user preferences, decisions, corrections, or source-backed notes could change the answer. Current user instructions and current source material win.

### Skill Resolver

Route Cortex work to the appropriate skill(s) based on what you're trying to do.

#### Knowledgebase operations

| Trigger | Skill |
| --- | --- |
| "What do we know about", "tell me about", "search for", "who is", "background on", "notes on" | cortex-query |
| "Who knows who", "relationship between", "connections", "graph query" | cortex-query |
| Creating or enriching a durable entity/page with current context, such as a person, company, project, product, tool, etc. | cortex-enrich |
| "enrich this article", "enrich this source", "make this source useful", imported source needs utility | cortex-source-enrich |
| "store this research", "put this in Cortex", "make this re-doable", "DRY this up", "file all of this", "organize all of this work", "archive this research thread" | cortex-organize |
| "fix citations", "citation audit", "check citations", "broken citations", missing source refs, or weak provenance | cortex-citation-fixer |
| "validate frontmatter", "check frontmatter", "fix frontmatter", "frontmatter audit", "Cortex lint", or page metadata issues | cortex-frontmatter-guard |
| "where does this Cortex page go", "file this in Cortex", "taxonomy check", "refile Cortex page", or "which page/type should this use" | cortex-taxonomist |
| "add a page type", "add a type to my schema", "schema author", "schema mutate", "schema add", "my Cortex has untyped pages", "propose new types from my corpus", "backfill page types", "evolve my schema", "researcher type", "make X an expert type", "add a link type", or a Cortex write needs a clearer page/link type | cortex-schema |

#### Content and media ingestion

| Trigger | Skill |
| --- | --- |
| "capture this", "save this thought", "remember this", "save to Cortex", "correct this" | cortex-capture |
| User shares a link, article, X post, newsletter, idea, etc. | cortex-idea-ingest |
| "watch this video", "process this YouTube link", "ingest this PDF", "save this podcast", "process this book", "summarize this book", "PDF book", "ingest it into Cortex", "what's in this screenshot", "check out this repo", etc. | cortex-media-ingest |
| Generic "ingest this" | cortex-ingest |

### Routing Rules

Prefer the most specific Cortex skill. Route URLs/media by content type. For known entities, query first unless creating or updating a durable page. Ask when ambiguity would change what gets written.

### Conflicts

Priority: current user statement > Cortex compiled truth > Cortex timeline > external sources.

### Captures

Tavern automatically processes chat history into Cortex memory in the background. Use cortex-capture for explicit saves, corrections, durable preferences, source-backed observations, project facts, or reusable notes. Keep captures small, inspectable, source-linked, and traceable. Do not capture guesses, broad chat dumps, secrets, or sensitive material without clear user reason.

Write only durable, reusable knowledge. Do not create pages for incidental mentions, unsupported claims, transient task state, or low-value source fragments.

Preserve provenance. Include source context when available: user message, chat, message id, date, source page, or URL.

Mention related page names/slugs. State relationships plainly: "uses OpenRouter", "depends on Tavern Runtime", "contradicts the old pricing assumption".

Create pages only for likely-reusable info. If the user explicitly asks to remember something and no subject page fits, use cortex-capture with type: "note" and a clear title.

Preserve corrections and contradictions as evidence. Update current truth without erasing old evidence.

Default Cortex page types: ${defaultCortexPageTypes.join(', ')}. Prefer these unless the active Cortex schema or user direction calls for a different type.

This AGENTS.md file is generated by Tavern. Do not edit it directly. To update your own durable operating notes, use the Tavern workspace notes tools.`;

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
