import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import {
    generateAgentInstructions,
    generatedInstructionFileName,
    registerAgentWorkspace,
} from './instructions';
import { agentNotesFileName } from './managed-instructions';
import { closeAgentNotesWatchers, ensureAgentNotesWatcher } from './notes-watcher';

describe('agent notes watcher', () => {
    let workspaceDir: string;

    beforeEach(async () => {
        workspaceDir = await mkdtemp(path.join(tmpdir(), 'tavern-notes-watcher-'));
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(async () => {
        closeAgentNotesWatchers();
        closeDb();
        await rm(workspaceDir, { force: true, recursive: true });
    });

    test('regenerates AGENTS.md when the agent edits NOTES.md directly', async () => {
        registerAgentWorkspace(getDb(), {
            agentId: 'planner',
            agentName: 'Planner',
            workspaceDir,
        });
        await generateAgentInstructions(getDb(), 'planner');
        ensureAgentNotesWatcher(getDb(), 'planner');

        await writeFile(
            path.join(workspaceDir, agentNotesFileName),
            '# Notes\n\nWatcher saw this edit.\n'
        );

        await vi.waitFor(
            async () => {
                const content = await readFile(
                    path.join(workspaceDir, generatedInstructionFileName),
                    'utf8'
                );
                expect(content).toContain('Watcher saw this edit.');
            },
            { interval: 100, timeout: 5000 }
        );
    });

    test('skips agents without a registered workspace', () => {
        expect(() => ensureAgentNotesWatcher(getDb(), 'unknown-agent')).not.toThrow();
    });
});
