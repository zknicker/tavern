import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { subscribeToRuntimeEvents } from '../tavern/runtime-events';
import {
    clearHermesBootstrapFiles,
    generatedInstructionFileName,
    getAgentWorkspaceSource,
    hermesBootstrapFileNamesToClear,
    managedBlockEndMarker,
    readRenderedAgentInstructions,
    reconcileAgentInstructions,
    reconcileRegisteredAgentInstructions,
    registerAgentWorkspace,
    renderManagedInstructionBlock,
} from './instructions';
import { renderManagedInstructionContent } from './managed-instructions';
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

    function registerPlanner() {
        return registerAgentWorkspace(getDb(), {
            agentId: 'planner',
            agentName: 'Planner',
            workspaceDir,
        });
    }

    async function readAgentsFile() {
        return await readFile(path.join(workspaceDir, generatedInstructionFileName), 'utf8');
    }

    test('seeds a missing AGENTS.md with the managed block and user hint', async () => {
        registerPlanner();

        const result = await reconcileAgentInstructions(getDb(), 'planner');
        const content = await readAgentsFile();

        expect(result.written).toBe(true);
        expect(result.sha256).toMatch(/^[a-f0-9]{64}$/u);
        expect(content).toBe(result.content);
        expect(content).toMatch(/^<!-- tavern:managed v=[a-f0-9]{16} -->\n/u);
        expect(content).toContain(managedBlockEndMarker);
        expect(content).toContain('You are Planner, the resident agent of Tavern');
        expect(content).toContain('Everything below is yours.');
    });

    test('managed content speaks product language and keeps memory guidance', () => {
        const content = renderManagedInstructionContent('Planner');

        expect(content).not.toMatch(/hermes/iu);
        expect(content).toContain('## Environment');
        expect(content).toContain('## Delegation');
        expect(content).toContain('## Memory');
        expect(content).toContain("Cortex is Tavern's durable knowledge store");
        expect(content).toContain('Prefer the installed `wiki` skill for wiki work.');
        expect(content).toContain('Priority: current user statement');
        expect(content).toContain('Preserve provenance');
        expect(content).toContain('## Maintaining These Files');
        expect(content).toContain('edit `SOUL.md`');
        expect(content).not.toContain('Tavern workspace notes tools');
    });

    test('reconcile is idempotent and only emits an event when the file changes', async () => {
        const events: unknown[] = [];
        const unsubscribe = subscribeToRuntimeEvents((event) => events.push(event));

        try {
            registerPlanner();
            const first = await reconcileAgentInstructions(getDb(), 'planner');
            const second = await reconcileAgentInstructions(getDb(), 'planner');

            expect(first.written).toBe(true);
            expect(second.written).toBe(false);
            expect(second.content).toBe(first.content);
            expect(events).toHaveLength(1);
            expect(events[0]).toMatchObject({
                agentId: 'planner',
                path: generatedInstructionFileName,
                sha256: first.sha256,
                type: 'workspace.instructions.updated',
            });
        } finally {
            unsubscribe();
        }
    });

    test('replaces a stale managed block and preserves user content byte-for-byte', async () => {
        const userContent =
            '\n\n# My Rules\n\n  - keep indentation\n\ttabs too\n\nTrailing spaces:   \n';
        await writeFile(
            path.join(workspaceDir, generatedInstructionFileName),
            `<!-- tavern:managed v=0123456789abcdef -->\nold managed text\n${managedBlockEndMarker}${userContent}`
        );
        registerPlanner();

        const result = await reconcileAgentInstructions(getDb(), 'planner');
        const expectedBlock = await renderManagedInstructionBlock('Planner');

        expect(result.written).toBe(true);
        expect(result.content).toBe(`${expectedBlock}${userContent}`);
        expect(result.content).not.toContain('old managed text');
    });

    test('rewrites the managed block when the agent is renamed', async () => {
        registerPlanner();
        await reconcileAgentInstructions(getDb(), 'planner');
        const seeded = await readAgentsFile();
        await writeFile(
            path.join(workspaceDir, generatedInstructionFileName),
            `${seeded}\nUser appended note.\n`
        );

        registerAgentWorkspace(getDb(), {
            agentId: 'planner',
            agentName: 'Navigator',
            workspaceDir,
        });
        const result = await reconcileAgentInstructions(getDb(), 'planner');

        expect(result.written).toBe(true);
        expect(result.content).toContain('You are Navigator, the resident agent of Tavern');
        expect(result.content).not.toContain('You are Planner');
        expect(result.content).toContain('User appended note.');
    });

    test('re-inserts the managed block at the top when markers were deleted', async () => {
        const userOnly = '# Mine\n\nAll user content, markers deleted.\n';
        await writeFile(path.join(workspaceDir, generatedInstructionFileName), userOnly);
        registerPlanner();

        const result = await reconcileAgentInstructions(getDb(), 'planner');
        const expectedBlock = await renderManagedInstructionBlock('Planner');

        expect(result.written).toBe(true);
        expect(result.content).toBe(`${expectedBlock}\n\n${userOnly}`);
    });

    test('prepends a fresh block when the end marker is missing', async () => {
        const broken = '<!-- tavern:managed v=0123456789abcdef -->\ndangling start, no end\n';
        await writeFile(path.join(workspaceDir, generatedInstructionFileName), broken);
        registerPlanner();

        const result = await reconcileAgentInstructions(getDb(), 'planner');
        const expectedBlock = await renderManagedInstructionBlock('Planner');

        expect(result.written).toBe(true);
        expect(result.content).toBe(`${expectedBlock}\n\n${broken}`);

        const repeat = await reconcileAgentInstructions(getDb(), 'planner');
        expect(repeat.written).toBe(false);
    });

    test('seeding clears legacy bootstrap files but never SOUL.md', async () => {
        await Promise.all(
            hermesBootstrapFileNamesToClear.map((fileName) =>
                writeFile(path.join(workspaceDir, fileName), 'legacy bootstrap')
            )
        );
        await writeFile(path.join(workspaceDir, 'SOUL.md'), 'identity');
        registerPlanner();

        await reconcileAgentInstructions(getDb(), 'planner');

        await Promise.all(
            hermesBootstrapFileNamesToClear.map((fileName) =>
                expect(readFile(path.join(workspaceDir, fileName), 'utf8')).resolves.toBe('')
            )
        );
        await expect(readFile(path.join(workspaceDir, 'SOUL.md'), 'utf8')).resolves.toBe(
            'identity'
        );
    });

    test('clearHermesBootstrapFiles leaves AGENTS.md untouched', async () => {
        await writeFile(path.join(workspaceDir, generatedInstructionFileName), 'managed');

        await clearHermesBootstrapFiles(workspaceDir);

        await expect(readAgentsFile()).resolves.toBe('managed');
    });

    test('registered-only reconcile heals registered agents and skips unknown ones', async () => {
        await expect(
            reconcileRegisteredAgentInstructions(getDb(), 'unknown-agent')
        ).resolves.toBeNull();

        registerPlanner();
        const result = await reconcileRegisteredAgentInstructions(getDb(), 'planner');

        expect(result?.written).toBe(true);
        await expect(readAgentsFile()).resolves.toBe(result?.content);
    });

    test('register preserves the stored agent name when omitted', () => {
        registerPlanner();
        registerAgentWorkspace(getDb(), { agentId: 'planner', workspaceDir });

        expect(getAgentWorkspaceSource(getDb(), 'planner')).toMatchObject({
            agentId: 'planner',
            agentName: 'Planner',
            workspaceDir,
        });
    });

    test('reads the rendered AGENTS.md from disk with tracked hash', async () => {
        registerPlanner();
        const reconciled = await reconcileAgentInstructions(getDb(), 'planner');

        const read = await readRenderedAgentInstructions(getDb(), 'planner');

        expect(read).toMatchObject({
            agentId: 'planner',
            path: generatedInstructionFileName,
            renderedAt: reconciled.renderedAt,
            sha256: reconciled.sha256,
        });
        expect(read.content).toBe(reconciled.content);
    });

    test('instructions GET route returns the rendered AGENTS.md file', async () => {
        registerPlanner();
        await reconcileAgentInstructions(getDb(), 'planner');

        const response = await handleWorkspaceRequest(
            new Request('http://runtime.test/workspace/agents/planner/instructions')
        );
        const body = (await response?.json()) as { content: string; path: string };

        expect(response?.status).toBe(200);
        expect(body.path).toBe(generatedInstructionFileName);
        expect(body.content).toContain('You are Planner, the resident agent of Tavern');
    });

    test('instructions PUT route registers the workspace and reconciles the block', async () => {
        const userContent = 'User edits stay.\n';
        await writeFile(
            path.join(workspaceDir, generatedInstructionFileName),
            `<!-- tavern:managed v=0123456789abcdef -->\nstale\n${managedBlockEndMarker}\n\n${userContent}`
        );

        const response = await handleWorkspaceRequest(
            new Request('http://runtime.test/workspace/agents/planner/instructions', {
                body: JSON.stringify({ agentName: 'Planner', workspaceDir }),
                headers: { 'content-type': 'application/json' },
                method: 'PUT',
            })
        );
        const body = (await response?.json()) as {
            agentId: string;
            renderedAt: string;
            sha256: string;
            updatedAt: string;
        };

        expect(response?.status).toBe(200);
        expect(body.agentId).toBe('planner');
        expect(body.sha256).toMatch(/^[a-f0-9]{64}$/u);
        expect(Date.parse(body.renderedAt)).not.toBeNaN();
        expect(Date.parse(body.updatedAt)).not.toBeNaN();

        const content = await readAgentsFile();
        expect(content).not.toContain('stale');
        expect(content).toContain('You are Planner, the resident agent of Tavern');
        expect(content).toContain(userContent);
    });
});
