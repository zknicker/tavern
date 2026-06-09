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
    ensureAgentInstructionsFile,
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
            notes: 'Prefer llm-wiki for prior project decisions.',
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
        expect(content).toContain("Cortex is Tavern's browser for the llm-wiki hub.");
        expect(content).toContain('The wiki is plain Markdown owned by the user.');
        expect(content).toContain('prior project context');
        expect(content).toContain('### llm-wiki');
        expect(content).toContain('Prefer the installed `wiki` skill for wiki work.');
        expect(content).toContain('research a topic and compile findings');
        expect(content).toContain('ingest a source');
        expect(content).toContain('query existing wiki knowledge');
        expect(content).toContain('audit an output or article');
        expect(content).toContain('~/.config/llm-wiki/config.json');
        expect(content).toContain('topics/<slug>/');
        expect(content).toContain('topics/.archive/<slug>/');
        expect(content).toContain('raw/');
        expect(content).toContain('wiki/');
        expect(content).toContain('inventory/');
        expect(content).toContain('datasets/');
        expect(content).toContain('output/');
        expect(content).toContain('_index.md');
        expect(content).toContain('config.md');
        expect(content).toContain('log.md');
        expect(content).toContain('### Routing');
        expect(content).toContain('For quick answers, read/search the wiki first.');
        expect(content).toContain('route through llm-wiki');
        expect(content).toContain('### Conflicts');
        expect(content).toContain('Priority: current user statement');
        expect(content).toContain('### Writes');
        expect(content).toContain('Preserve provenance');
        expect(content).toContain('Do not save secrets or broad chat dumps');
        expect(content).toContain('Use Tasks or Runtime crons for scheduled wiki work.');
        expect(content).not.toContain('Cortex Chat Ingestion');
        expect(content).not.toContain('Cortex Generate Embeddings job');
        expect(content).toContain('Speak plainly.');
        expect(content).toContain('Prefer llm-wiki');
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

    test('workspace instruction sync preserves an existing AGENTS.md file', async () => {
        const db = getDb();
        await writeFile(
            path.join(workspaceDir, generatedInstructionFileName),
            '# Existing\n\nUser-edited instructions.'
        );
        updateAgentInstructionSource(db, {
            agentId: 'planner',
            agentName: 'Planner',
            userInstructions: 'Generated instructions.',
            workspaceDir,
        });

        const result = await ensureAgentInstructionsFile(db, 'planner');

        expect(result.content).toBe('# Existing\n\nUser-edited instructions.');
        await expect(
            readFile(path.join(workspaceDir, generatedInstructionFileName), 'utf8')
        ).resolves.toBe('# Existing\n\nUser-edited instructions.');
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

    test('clears unsupported Hermes bootstrap files owned by Tavern AGENTS.md composition', async () => {
        await Promise.all(
            hermesBootstrapFileNamesToClear.map((fileName) =>
                writeFile(path.join(workspaceDir, fileName), 'legacy bootstrap')
            )
        );
        await writeFile(path.join(workspaceDir, generatedInstructionFileName), 'managed');
        await writeFile(path.join(workspaceDir, 'SOUL.md'), 'supported');

        await clearHermesBootstrapFiles(workspaceDir);

        await expect(
            readFile(path.join(workspaceDir, generatedInstructionFileName), 'utf8')
        ).resolves.toBe('managed');
        await expect(readFile(path.join(workspaceDir, 'SOUL.md'), 'utf8')).resolves.toBe(
            'supported'
        );
        await Promise.all(
            hermesBootstrapFileNamesToClear.map((fileName) =>
                expect(readFile(path.join(workspaceDir, fileName), 'utf8')).resolves.toBe('')
            )
        );
    });
});
