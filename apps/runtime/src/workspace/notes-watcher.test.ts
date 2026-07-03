import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { subscribeToRuntimeEvents } from '../tavern/runtime-events';
import {
    generateAgentInstructions,
    readRenderedAgentInstructions,
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

    test('refreshes rendered system prompt metadata when the agent edits NOTES.md directly', async () => {
        registerAgentWorkspace(getDb(), {
            agentId: 'planner',
            agentName: 'Planner',
            workspaceDir,
        });
        await generateAgentInstructions(getDb(), 'planner');
        ensureAgentNotesWatcher(getDb(), 'planner');
        const events: unknown[] = [];
        const unsubscribe = subscribeToRuntimeEvents((event) => events.push(event));

        try {
            await writeFile(
                path.join(workspaceDir, agentNotesFileName),
                '# Notes\n\nWatcher saw this edit.\n'
            );

            await waitForEvent(() =>
                events.some(
                    (event) =>
                        isRecord(event) &&
                        event.agentId === 'planner' &&
                        event.type === 'workspace.instructions.updated'
                )
            );
            await expect(readRenderedAgentInstructions(getDb(), 'planner')).resolves.toMatchObject({
                content: expect.stringContaining('Watcher saw this edit.'),
            });
        } finally {
            unsubscribe();
        }
    });

    test('skips agents without a registered workspace', () => {
        expect(() => ensureAgentNotesWatcher(getDb(), 'unknown-agent')).not.toThrow();
    });
});

async function waitForEvent(predicate: () => boolean) {
    const deadline = Date.now() + 5000;

    while (Date.now() < deadline) {
        if (predicate()) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    expect(predicate()).toBe(true);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
