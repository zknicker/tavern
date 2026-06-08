import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { subscribeToRuntimeEvents } from '../tavern/runtime-events';
import {
    clearHermesBootstrapFiles,
    composeAgentInstructions,
    generatedInstructionFileName,
    getAgentInstructionSource,
    hermesBootstrapFileNamesToClear,
    readRenderedAgentInstructions,
    renderAgentInstructions,
    updateAgentInstructionSource,
    updateAgentNotes,
} from './instructions';
import { handleWorkspaceRequest } from './routes';

describe('workspace instructions', () => {
    let workspaceDir: string;

    beforeEach(async () => {
        workspaceDir = await mkdtemp(path.join(tmpdir(), 'tavern-workspace-instructions-'));
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(async () => {
        closeDb();
        await rm(workspaceDir, { force: true, recursive: true });
    });

    test('renders generated AGENTS.md from user instructions and agent notes', async () => {
        const db = getDb();
        updateAgentInstructionSource(db, {
            agentId: 'planner',
            agentName: 'Planner',
            userInstructions: 'Speak plainly.',
            workspaceDir,
        });
        updateAgentNotes(db, {
            agentId: 'planner',
            notes: 'Prefer Cortex recall for prior project decisions.',
        });

        const result = await renderAgentInstructions(db, 'planner');
        const content = await readFile(
            path.join(workspaceDir, generatedInstructionFileName),
            'utf8'
        );

        expect(result.sha256).toMatch(/^[a-f0-9]{64}$/u);
        expect(content).toContain(
            'You are Planner, a Tavern-managed agent inside the Tavern chat app.'
        );
        expect(content).not.toContain('Hermes sessions and turns are execution evidence');
        expect(content).toContain('## Delegation');
        expect(content).toContain('Work inline for quick, narrow, real-time tasks.');
        expect(content).toContain('Use subagents for isolated context');
        expect(content).toContain('broad exploration, parallel research, independent review');
        expect(content).toContain('flood the main thread with logs/search/files');
        expect(content).toContain('Give subagents a clear goal, context, constraints');
        expect(content).toContain('Synthesize results before replying');
        expect(content).toContain('Do not delegate simple lookups, small edits');
        expect(content).toContain('## Cortex');
        expect(content).toContain('Cortex is Tavern');
        expect(content).toContain('durable knowledgebase and memory');
        expect(content).toContain('prior project context');
        expect(content).not.toContain('### Knowledge Lookup Tools');
        expect(content).not.toContain('cortex_get_page: exact page/slug');
        expect(content).not.toContain('cortex_recall tokenmax: broad synthesis only');
        expect(content).toContain('### Skill Resolver');
        expect(content).toContain('Route Cortex work to the appropriate skill');
        expect(content).not.toContain('#### Always-on');
        expect(content).not.toContain('Every inbound message');
        expect(content).not.toContain('Cortex Chat Ingestion and Cortex Dream handle background');
        expect(content).toContain('#### Knowledgebase operations');
        expect(content).toContain('"What do we know about", "tell me about"');
        expect(content).toContain('"Who knows who", "relationship between"');
        expect(content).toContain('Creating or enriching a durable entity/page');
        expect(content).toContain('person, company, project, product, tool, etc.');
        expect(content).toContain('cortex-enrich');
        expect(content).toContain('"enrich this article", "enrich this source"');
        expect(content).toContain('cortex-source-enrich');
        expect(content).toContain('"store this research", "put this in Cortex"');
        expect(content).toContain('cortex-organize');
        expect(content).toContain('"fix citations", "citation audit", "check citations"');
        expect(content).toContain('weak provenance');
        expect(content).toContain('cortex-citation-fixer');
        expect(content).toContain('"validate frontmatter", "check frontmatter"');
        expect(content).toContain('"Cortex lint", or page metadata issues');
        expect(content).toContain('cortex-frontmatter-guard');
        expect(content).toContain('"where does this Cortex page go", "file this in Cortex"');
        expect(content).toContain('"refile Cortex page"');
        expect(content).toContain('"which page/type should this use"');
        expect(content).toContain('cortex-taxonomist');
        expect(content).toContain('"add a page type", "add a type to my schema"');
        expect(content).toContain('"schema author", "schema mutate", "schema add"');
        expect(content).toContain('"my Cortex has untyped pages"');
        expect(content).toContain('"propose new types from my corpus"');
        expect(content).toContain('"backfill page types", "evolve my schema"');
        expect(content).toContain('"researcher type", "make X an expert type"');
        expect(content).toContain('"add a link type"');
        expect(content).toContain('clearer page/link type');
        expect(content).toContain('cortex-schema');
        expect(content).toContain('#### Content and media ingestion');
        expect(content).toContain('"capture this", "save this thought"');
        expect(content).toContain('cortex-capture');
        expect(content).toContain('User shares a link, article, X post, newsletter, idea, etc.');
        expect(content).toContain('cortex-idea-ingest');
        expect(content).toContain('"watch this video", "process this YouTube link"');
        expect(content).toContain('check out this repo", etc.');
        expect(content).toContain('cortex-media-ingest');
        expect(content).toContain('Generic "ingest this"');
        expect(content).toContain('### Routing Rules');
        expect(content).toContain('Prefer the most specific Cortex skill');
        expect(content).toContain('Route URLs/media by content type');
        expect(content).toContain(
            'For known entities, query first unless creating or updating a durable page'
        );
        expect(content).toContain('Ask when ambiguity would change what gets written');
        expect(content).not.toContain('#### Maintenance and synthesis');
        expect(content).not.toContain('"Run dream", "process today');
        expect(content).not.toContain('"Brain health"');
        expect(content).not.toContain('Cortex Generate Embeddings job');
        expect(content).not.toContain('If two skills match, read both');
        expect(content).not.toContain('Chain only when each step adds lasting value');
        expect(content).not.toContain('### Tools');
        expect(content).not.toContain('Skills route the work. Tools execute it');
        expect(content).not.toContain(
            'Exact title, slug, keyword, or existence check: cortex_search'
        );
        expect(content).not.toContain('Semantic memory lookup: cortex_recall');
        expect(content).not.toContain('Backlinks or relationship graph: cortex_list_backlinks');
        expect(content).toContain('### Conflicts');
        expect(content).toContain('Priority: current user statement');
        expect(content).toContain('### Captures');
        expect(content).toContain('Tavern automatically processes chat history into Cortex memory');
        expect(content).toContain('Use cortex-capture for explicit saves');
        expect(content).toContain('Keep captures small, inspectable, source-linked');
        expect(content).toContain('Write only durable, reusable knowledge');
        expect(content).toContain('incidental mentions, unsupported claims');
        expect(content).toContain('transient task state, or low-value source fragments');
        expect(content).not.toContain('Background chat memory belongs to Cortex Chat Ingestion');
        expect(content).toContain('Preserve provenance');
        expect(content).toContain('Mention related page names/slugs');
        expect(content).toContain('use cortex-capture with type: "note"');
        expect(content).toContain('Preserve corrections and contradictions as evidence');
        expect(content).toContain('Default Cortex page types:');
        expect(content).toContain('Speak plainly.');
        expect(content).toContain('Prefer Cortex recall');
    });

    test('emits an AGENTS.md update event when rendered instructions are written', async () => {
        const db = getDb();
        const events: unknown[] = [];
        const unsubscribe = subscribeToRuntimeEvents((event) => events.push(event));

        try {
            updateAgentInstructionSource(db, {
                agentId: 'planner',
                agentName: 'Planner',
                userInstructions: 'Speak plainly.',
                workspaceDir,
            });

            const result = await renderAgentInstructions(db, 'planner');

            expect(events).toContainEqual({
                agentId: 'planner',
                path: generatedInstructionFileName,
                renderedAt: result.renderedAt,
                sha256: result.sha256,
                timestamp: result.renderedAt,
                type: 'workspace.instructions.updated',
            });
        } finally {
            unsubscribe();
        }
    });

    test('preserves notes when user instructions change', () => {
        const db = getDb();
        updateAgentInstructionSource(db, {
            agentId: 'planner',
            agentName: 'Planner',
            userInstructions: 'First instructions.',
            workspaceDir,
        });
        updateAgentNotes(db, {
            agentId: 'planner',
            notes: 'Durable agent note.',
        });
        updateAgentInstructionSource(db, {
            agentId: 'planner',
            userInstructions: 'Second instructions.',
            workspaceDir,
        });

        expect(getAgentInstructionSource(db, 'planner')).toMatchObject({
            notes: 'Durable agent note.',
            userInstructions: 'Second instructions.',
        });
    });

    test('reads rendered AGENTS.md from disk', async () => {
        const db = getDb();
        updateAgentInstructionSource(db, {
            agentId: 'planner',
            agentName: 'Planner',
            userInstructions: 'Saved instructions.',
            workspaceDir,
        });
        updateAgentNotes(db, {
            agentId: 'planner',
            notes: 'Durable agent note.',
        });

        const rendered = await renderAgentInstructions(db, 'planner');
        const read = await readRenderedAgentInstructions(db, 'planner');

        expect(read).toMatchObject({
            agentId: 'planner',
            path: generatedInstructionFileName,
            renderedAt: rendered.renderedAt,
            sha256: rendered.sha256,
        });
        expect(read.content).toContain(
            'You are Planner, a Tavern-managed agent inside the Tavern chat app.'
        );
        expect(read.content).toContain('Saved instructions.');
        expect(read.content).toContain('Durable agent note.');
    });

    test('instructions route returns the rendered AGENTS.md file', async () => {
        const db = getDb();
        updateAgentInstructionSource(db, {
            agentId: 'planner',
            agentName: 'Planner',
            userInstructions: 'Saved instructions.',
            workspaceDir,
        });
        await renderAgentInstructions(db, 'planner');

        const response = await handleWorkspaceRequest(
            new Request('http://runtime.test/workspace/agents/planner/instructions')
        );
        const body = (await response?.json()) as { content: string; path: string };

        expect(response?.status).toBe(200);
        expect(body.path).toBe(generatedInstructionFileName);
        expect(body.content).toContain('Saved instructions.');
    });

    test('preserves an explicit empty user instructions update', () => {
        const db = getDb();
        updateAgentInstructionSource(db, {
            agentId: 'planner',
            agentName: 'Planner',
            userInstructions: 'First instructions.',
            workspaceDir,
        });
        updateAgentInstructionSource(db, {
            agentId: 'planner',
            userInstructions: '',
            workspaceDir,
        });

        expect(getAgentInstructionSource(db, 'planner')).toMatchObject({
            userInstructions: '',
        });
    });

    test('composition omits empty optional sections', () => {
        expect(
            composeAgentInstructions({
                agentName: 'Planner',
                notes: '',
                userInstructions: '',
            })
        ).not.toContain('\n\n\n');
    });

    test('clears Hermes bootstrap files owned by Tavern AGENTS.md composition', async () => {
        await Promise.all(
            hermesBootstrapFileNamesToClear.map((fileName) =>
                writeFile(path.join(workspaceDir, fileName), 'legacy bootstrap')
            )
        );
        await writeFile(path.join(workspaceDir, generatedInstructionFileName), 'managed');

        await clearHermesBootstrapFiles(workspaceDir);

        await expect(
            readFile(path.join(workspaceDir, generatedInstructionFileName), 'utf8')
        ).resolves.toBe('managed');
        await Promise.all(
            hermesBootstrapFileNamesToClear.map((fileName) =>
                expect(readFile(path.join(workspaceDir, fileName), 'utf8')).resolves.toBe('')
            )
        );
    });
});
