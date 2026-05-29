import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import {
    clearOpenClawBootstrapFiles,
    composeAgentInstructions,
    generatedInstructionFileName,
    getAgentInstructionSource,
    openClawBootstrapFileNamesToClear,
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
        expect(content).toContain('You are Planner, a Tavern-managed agent.');
        expect(content).toContain('Cortex is Tavern');
        expect(content).toContain("Follow Tavern's Cortex operating resources");
        expect(content).toContain('Use cortex_recall with tokenmax mode only');
        expect(content).toContain('Default Cortex page types:');
        expect(content).toContain('Speak plainly.');
        expect(content).toContain('Prefer Cortex recall');
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

    test('notes route accepts an explicit empty update', async () => {
        const db = getDb();
        updateAgentInstructionSource(db, {
            agentId: 'planner',
            agentName: 'Planner',
            userInstructions: 'First instructions.',
            workspaceDir,
        });
        updateAgentNotes(db, {
            agentId: 'planner',
            notes: 'Temporary operating note.',
        });

        const response = await handleWorkspaceRequest(
            new Request('http://runtime.test/workspace/agents/planner/notes', {
                body: JSON.stringify({ notes: '' }),
                method: 'PUT',
            })
        );

        expect(response?.status).toBe(200);
        expect(getAgentInstructionSource(db, 'planner')).toMatchObject({
            notes: '',
        });
        await expect(
            readFile(path.join(workspaceDir, generatedInstructionFileName), 'utf8')
        ).resolves.not.toContain('Temporary operating note.');
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

    test('clears OpenClaw bootstrap files owned by Tavern AGENTS.md composition', async () => {
        await Promise.all(
            openClawBootstrapFileNamesToClear.map((fileName) =>
                writeFile(path.join(workspaceDir, fileName), 'legacy bootstrap')
            )
        );
        await writeFile(path.join(workspaceDir, generatedInstructionFileName), 'managed');

        await clearOpenClawBootstrapFiles(workspaceDir);

        await expect(
            readFile(path.join(workspaceDir, generatedInstructionFileName), 'utf8')
        ).resolves.toBe('managed');
        await Promise.all(
            openClawBootstrapFileNamesToClear.map((fileName) =>
                expect(readFile(path.join(workspaceDir, fileName), 'utf8')).resolves.toBe('')
            )
        );
    });
});
