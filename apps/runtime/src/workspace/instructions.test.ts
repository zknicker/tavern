import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import {
    composeAgentInstructions,
    generatedInstructionFileName,
    getAgentInstructionSource,
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

    test('renders generated AGENTS.md from managed soul and agent notes', async () => {
        const db = getDb();
        updateAgentInstructionSource(db, {
            agentId: 'planner',
            agentName: 'Planner',
            soul: 'Speak plainly.',
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
        expect(content).toContain('Speak plainly.');
        expect(content).toContain('Prefer Cortex recall');
    });

    test('preserves notes when the user-authored soul changes', () => {
        const db = getDb();
        updateAgentInstructionSource(db, {
            agentId: 'planner',
            agentName: 'Planner',
            soul: 'First soul.',
            workspaceDir,
        });
        updateAgentNotes(db, {
            agentId: 'planner',
            notes: 'Durable agent note.',
        });
        updateAgentInstructionSource(db, {
            agentId: 'planner',
            soul: 'Second soul.',
            workspaceDir,
        });

        expect(getAgentInstructionSource(db, 'planner')).toMatchObject({
            notes: 'Durable agent note.',
            soul: 'Second soul.',
        });
    });

    test('preserves an explicit empty soul update', () => {
        const db = getDb();
        updateAgentInstructionSource(db, {
            agentId: 'planner',
            agentName: 'Planner',
            soul: 'First soul.',
            workspaceDir,
        });
        updateAgentInstructionSource(db, {
            agentId: 'planner',
            soul: '',
            workspaceDir,
        });

        expect(getAgentInstructionSource(db, 'planner')).toMatchObject({
            soul: '',
        });
    });

    test('notes route accepts an explicit empty update', async () => {
        const db = getDb();
        updateAgentInstructionSource(db, {
            agentId: 'planner',
            agentName: 'Planner',
            soul: 'First soul.',
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
                soul: '',
            })
        ).not.toContain('\n\n\n');
    });
});
