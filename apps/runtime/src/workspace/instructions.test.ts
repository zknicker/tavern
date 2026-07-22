import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { subscribeToRuntimeEvents } from '../tavern/runtime-events.ts';
import {
    generateAgentInstructions,
    generateRegisteredAgentInstructions,
    getAgentWorkspaceSource,
    registerAgentWorkspace,
} from './instructions.ts';
import { handleWorkspaceRequest } from './routes.ts';

// Prompt CONTENT is guarded by agent-prompt-contract.test.ts; this suite
// covers generation mechanics only (persistence, events, workspace hygiene).
describe('generated agent instructions', () => {
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

    test('generates the Raft-template prompt body on first run', async () => {
        registerPlanner();

        const result = await generateAgentInstructions(getDb(), 'planner');

        expect(result.written).toBe(true);
        expect(result.sha256).toMatch(/^[a-f0-9]{64}$/u);
        expect(result.content).toMatch(/^You are "Planner", an AI agent in Grotto/u);
        expect(result.content).toContain('## Current Runtime Context');
        await expect(stat(path.join(workspaceDir, 'AGENTS.md'))).rejects.toThrow();
    });

    test('generation is deterministic and only writes on change', async () => {
        const events: unknown[] = [];
        const unsubscribe = subscribeToRuntimeEvents((event) => events.push(event));

        try {
            registerPlanner();
            const first = await generateAgentInstructions(getDb(), 'planner');
            const second = await generateAgentInstructions(getDb(), 'planner');

            expect(first.written).toBe(true);
            expect(second.written).toBe(false);
            expect(second.content).toBe(first.content);
            expect(events).toHaveLength(1);
        } finally {
            unsubscribe();
        }
    });

    test('removes existing generated AGENTS.md from the workspace', async () => {
        await writeFile(path.join(workspaceDir, 'AGENTS.md'), '# Old generated prompt\n');
        registerPlanner();

        await generateAgentInstructions(getDb(), 'planner');

        await expect(stat(path.join(workspaceDir, 'AGENTS.md'))).rejects.toThrow();
    });

    test('removes empty legacy companion files without deleting authored files', async () => {
        await writeFile(path.join(workspaceDir, 'BOOTSTRAP.md'), '');
        await writeFile(path.join(workspaceDir, 'HEARTBEAT.md'), '');
        await writeFile(path.join(workspaceDir, 'TOOLS.md'), '# Local tools\n');
        registerPlanner();

        await generateAgentInstructions(getDb(), 'planner');

        await expect(stat(path.join(workspaceDir, 'BOOTSTRAP.md'))).rejects.toThrow();
        await expect(stat(path.join(workspaceDir, 'HEARTBEAT.md'))).rejects.toThrow();
        await expect(readFile(path.join(workspaceDir, 'TOOLS.md'), 'utf8')).resolves.toBe(
            '# Local tools\n'
        );
    });

    test('rename regenerates with the new agent name', async () => {
        registerPlanner();
        await generateAgentInstructions(getDb(), 'planner');

        registerAgentWorkspace(getDb(), {
            agentId: 'planner',
            agentName: 'Navigator',
            workspaceDir,
        });
        const result = await generateAgentInstructions(getDb(), 'planner');

        expect(result.written).toBe(true);
        expect(result.content).toContain('You are "Navigator", an AI agent in Grotto');
    });

    test('generation never writes agent-owned memory files', async () => {
        await writeFile(path.join(workspaceDir, 'MEMORY.md'), 'agent memory index');
        registerPlanner();

        await generateAgentInstructions(getDb(), 'planner');

        await expect(readFile(path.join(workspaceDir, 'MEMORY.md'), 'utf8')).resolves.toBe(
            'agent memory index'
        );
    });

    test('registered-only generation skips unknown agents', async () => {
        await expect(
            generateRegisteredAgentInstructions(getDb(), 'unknown-agent')
        ).resolves.toBeNull();

        registerPlanner();
        const result = await generateRegisteredAgentInstructions(getDb(), 'planner');
        expect(result?.written).toBe(true);
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

    test('instructions GET route returns the rendered system prompt', async () => {
        registerPlanner();
        await generateAgentInstructions(getDb(), 'planner');

        const response = await handleWorkspaceRequest(
            new Request('http://runtime.test/workspace/agents/planner/instructions')
        );
        const body = (await response?.json()) as { content: string };

        expect(response?.status).toBe(200);
        expect(body.content).toContain('You are "Planner", an AI agent in Grotto');
    });

    test('instructions PUT route registers the workspace and renders the prompt metadata', async () => {
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

        await expect(stat(path.join(workspaceDir, 'AGENTS.md'))).rejects.toThrow();
    });
});
