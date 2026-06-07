import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { subscribeToRuntimeEvents } from '../tavern/runtime-events';
import {
    clearOpenClawBootstrapFiles,
    composeAgentInstructions,
    composeAgentWorkspaceFiles,
    generatedInstructionFileName,
    generatedWorkspaceFileNames,
    getAgentInstructionSource,
    openClawBootstrapFileNamesToClear,
    readRenderedAgentInstructions,
    renderAgentInstructions,
    updateAgentInstructionSource,
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

    test('seeds OpenClaw workspace files from templates', async () => {
        const db = getDb();
        updateAgentInstructionSource(db, {
            agentId: 'planner',
            agentName: 'Planner',
            userInstructions: 'Speak plainly.\nPreserve Blippy voice.',
            workspaceDir,
        });

        const result = await renderAgentInstructions(db, 'planner');
        const files = Object.fromEntries(
            await Promise.all(
                generatedWorkspaceFileNames.map(async (fileName) => [
                    fileName,
                    await readFile(path.join(workspaceDir, fileName), 'utf8'),
                ])
            )
        );

        expect(result.sha256).toMatch(/^[a-f0-9]{64}$/u);
        expect(result.files.map((file) => file.path)).toEqual([...generatedWorkspaceFileNames]);
        expect(files['AGENTS.md']).toContain('# AGENTS.md - The Workspace');
        expect(files['AGENTS.md']).toContain('## Session Startup');
        expect(files['AGENTS.md']).toContain('## Memory (Cortex)');
        expect(files['AGENTS.md']).toContain('Cortex is durable, wiki-style memory');
        expect(files['AGENTS.md']).toContain('### Knowledgebase Operation Skills');
        expect(files['AGENTS.md']).toContain('"What do we know about", "tell me about"');
        expect(files['AGENTS.md']).toContain('cortex-schema');
        expect(files['AGENTS.md']).toContain('cortex-media-ingest');
        expect(files['AGENTS.md']).toContain('### Skill Routing Rules');
        expect(files['AGENTS.md']).toContain('known entities, query first');
        expect(files['AGENTS.md']).toContain('Page types:');
        expect(files['AGENTS.md']).not.toContain('Preserve Blippy voice.');

        expect(files['SOUL.md']).toContain('# SOUL.md - Who I Am');
        expect(files['SOUL.md']).toContain('I am Planner.');
        expect(files['SOUL.md']).toContain('## Core');
        expect(files['SOUL.md']).toContain('## How I Talk');
        expect(files['SOUL.md']).toContain('## Boundaries');
        expect(files['SOUL.md']).not.toContain('## Tavern Personality');
        expect(files['SOUL.md']).not.toContain('Speak plainly');
        expect(files['SOUL.md']).not.toContain('Prefer Cortex recall');

        expect(files['TOOLS.md']).toContain('# TOOLS.md - Local Tool Notes');
        expect(files['TOOLS.md']).toContain('Skills define how tools work.');
        expect(files['TOOLS.md']).toContain('## Tavern');
        expect(files['TOOLS.md']).toContain(
            'Use Tavern message read/search for canonical Tavern chat history.'
        );
        expect(files['TOOLS.md']).toContain(
            'Use OpenClaw session tools for execution transcript evidence.'
        );
        expect(files['TOOLS.md']).toContain(
            'Edit `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, or `USER.md` directly'
        );
        expect(files['TOOLS.md']).not.toContain('workspace_notes');

        expect(files['IDENTITY.md']).toContain('# IDENTITY.md - Who Am I?');
        expect(files['IDENTITY.md']).toContain('- **Name:** Planner');
        expect(files['IDENTITY.md']).toContain('- **Role:** Tavern agent');
        expect(files['IDENTITY.md']).toContain('default identity seed');

        expect(files['USER.md']).toContain('# USER.md - About Your Human');
        expect(files['USER.md']).toContain('Preferred name: Zach.');
        expect(files['USER.md']).toContain('direct, answer-first communication');

        expect(files['AGENTS.md']).not.toContain('seeded by Tavern');
        expect(files['USER.md']).not.toContain('seeded by Tavern');
        expect(files['TOOLS.md']).not.toContain('seeded by Tavern');
        expect(files['SOUL.md']).not.toContain('seeded by Tavern');
        expect(files['IDENTITY.md']).not.toContain('seeded by Tavern');
        await Promise.all(
            openClawBootstrapFileNamesToClear.map((fileName) =>
                expect(readFile(path.join(workspaceDir, fileName), 'utf8')).resolves.toBe('')
            )
        );
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

    test('preserves user instructions when agent settings change', () => {
        const db = getDb();
        updateAgentInstructionSource(db, {
            agentId: 'planner',
            agentName: 'Planner',
            userInstructions: 'First instructions.',
            workspaceDir,
        });
        updateAgentInstructionSource(db, {
            agentId: 'planner',
            userInstructions: 'Second instructions.',
            workspaceDir,
        });

        expect(getAgentInstructionSource(db, 'planner')).toMatchObject({
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

        const rendered = await renderAgentInstructions(db, 'planner');
        const read = await readRenderedAgentInstructions(db, 'planner');

        expect(read).toMatchObject({
            agentId: 'planner',
            path: generatedInstructionFileName,
            renderedAt: rendered.renderedAt,
            sha256: rendered.sha256,
        });
        expect(read.content).toContain('# AGENTS.md - The Workspace');
        expect(read.content).not.toContain('Saved instructions.');
        await expect(readFile(path.join(workspaceDir, 'SOUL.md'), 'utf8')).resolves.not.toContain(
            'Saved instructions.'
        );
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
        expect(body.content).toContain('# AGENTS.md - The Workspace');
        expect(body.content).not.toContain('Saved instructions.');
    });

    test('instructions route preserves direct workspace file edits', async () => {
        const db = getDb();
        updateAgentInstructionSource(db, {
            agentId: 'planner',
            agentName: 'Planner',
            userInstructions: 'Old instructions.',
            workspaceDir,
        });
        await renderAgentInstructions(db, 'planner');
        await writeFile(path.join(workspaceDir, 'AGENTS.md'), '# AGENTS.md\n\nDirect edit.\n');

        const response = await handleWorkspaceRequest(
            new Request('http://runtime.test/workspace/agents/planner/instructions', {
                body: JSON.stringify({
                    agentName: 'Planner',
                    userInstructions: 'New instructions.',
                    workspaceDir,
                }),
                method: 'PUT',
            })
        );

        expect(response?.status).toBe(200);
        await expect(readFile(path.join(workspaceDir, 'AGENTS.md'), 'utf8')).resolves.toBe(
            '# AGENTS.md\n\nDirect edit.\n'
        );
        await expect(readFile(path.join(workspaceDir, 'SOUL.md'), 'utf8')).resolves.not.toContain(
            'New instructions.'
        );
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

    test('normal render does not overwrite direct workspace file edits', async () => {
        const db = getDb();
        updateAgentInstructionSource(db, {
            agentId: 'planner',
            agentName: 'Planner',
            userInstructions: 'Initial soul.',
            workspaceDir,
        });
        await renderAgentInstructions(db, 'planner');
        await writeFile(
            path.join(workspaceDir, generatedInstructionFileName),
            '# AGENTS.md\n\nDirect agent edit.\n'
        );

        const rerendered = await renderAgentInstructions(db, 'planner');
        const read = await readRenderedAgentInstructions(db, 'planner');

        await expect(
            readFile(path.join(workspaceDir, generatedInstructionFileName), 'utf8')
        ).resolves.toBe('# AGENTS.md\n\nDirect agent edit.\n');
        expect(rerendered.content).toBe('# AGENTS.md\n\nDirect agent edit.\n');
        expect(read.content).toBe(rerendered.content);
        expect(read.sha256).toBe(rerendered.sha256);
    });

    test('normal render replaces legacy generated workspace files once', async () => {
        const db = getDb();
        updateAgentInstructionSource(db, {
            agentId: 'planner',
            agentName: 'Planner',
            userInstructions: 'Initial soul.',
            workspaceDir,
        });
        await writeFile(
            path.join(workspaceDir, generatedInstructionFileName),
            'This file is generated by Tavern. Use Tavern workspace notes tools.\n'
        );

        await renderAgentInstructions(db, 'planner');

        await expect(
            readFile(path.join(workspaceDir, generatedInstructionFileName), 'utf8')
        ).resolves.toContain('# AGENTS.md - The Workspace');
    });

    test('composition omits empty optional sections', async () => {
        expect(
            await composeAgentInstructions({
                agentName: 'Planner',
                userInstructions: '',
            })
        ).not.toContain('\n\n\n');
    });

    test('composition emits OpenClaw bootstrap bundle with generic workspace seed files', async () => {
        const files = await composeAgentWorkspaceFiles({
            agentName: 'Planner',
            userInstructions: 'Custom Blippy personality.',
        });

        expect(files.map((file) => file.path)).toEqual([...generatedWorkspaceFileNames]);
        expect(files.find((file) => file.path === 'SOUL.md')?.content).toContain('I am Planner.');
        expect(files.find((file) => file.path === 'SOUL.md')?.content).not.toContain(
            'Custom Blippy personality.'
        );
    });

    test('clears optional OpenClaw bootstrap files without clearing generated files', async () => {
        await Promise.all(
            openClawBootstrapFileNamesToClear.map((fileName) =>
                writeFile(path.join(workspaceDir, fileName), 'legacy bootstrap')
            )
        );
        await Promise.all(
            generatedWorkspaceFileNames.map((fileName) =>
                writeFile(path.join(workspaceDir, fileName), `managed ${fileName}`)
            )
        );

        await clearOpenClawBootstrapFiles(workspaceDir);

        await Promise.all(
            generatedWorkspaceFileNames.map((fileName) =>
                expect(readFile(path.join(workspaceDir, fileName), 'utf8')).resolves.toBe(
                    `managed ${fileName}`
                )
            )
        );
        await Promise.all(
            openClawBootstrapFileNamesToClear.map((fileName) =>
                expect(readFile(path.join(workspaceDir, fileName), 'utf8')).resolves.toBe('')
            )
        );
    });
});
