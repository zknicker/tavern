import { mkdtempSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { resetAgentSession } from './agent-session-reset.ts';
import { ensureCurrentAgentSession, readCurrentAgentSession } from './agent-session-store.ts';
import { upsertStoredAgent } from './agents-store.ts';
import { listActivityForResponses, listResponses } from './chat-api/index.ts';

describe('agent session reset', () => {
    let workspaceDir: string;

    beforeEach(async () => {
        ensureRuntimeSchema(initTestDb());
        workspaceDir = mkdtempSync(path.join(os.tmpdir(), 'tavern-reset-'));
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: 'agt_otto',
                isAdmin: false,
                name: 'Otto',
                primaryColor: null,
                workspaceFolder: workspaceDir,
            },
        });
        await fs.writeFile(path.join(workspaceDir, 'NOTES.md'), 'keep me');
    });

    afterEach(async () => {
        closeDb();
        await fs.rm(workspaceDir, { force: true, recursive: true });
    });

    it('session reset starts the next generation and keeps the workspace', async () => {
        const before = ensureCurrentAgentSession({ agentId: 'agt_otto' });

        const { session } = await resetAgentSession({ agentId: 'agt_otto' });

        expect(session.generation).toBe(before.generation + 1);
        expect(readCurrentAgentSession({ agentId: 'agt_otto' })?.id).toBe(session.id);
        // Workspace and memory persist (specs/sessions.md).
        await expect(fs.readFile(path.join(workspaceDir, 'NOTES.md'), 'utf8')).resolves.toBe(
            'keep me'
        );
    });

    it('full reset wipes and recreates the workspace', async () => {
        ensureCurrentAgentSession({ agentId: 'agt_otto' });

        const { session } = await resetAgentSession({ agentId: 'agt_otto', kind: 'full' });

        expect(readCurrentAgentSession({ agentId: 'agt_otto' })?.id).toBe(session.id);
        const entries = await fs.readdir(workspaceDir);
        expect(entries).not.toContain('NOTES.md');
    });

    it('lands a durable new_session notice in the agent DM', async () => {
        ensureCurrentAgentSession({ agentId: 'agt_otto' });

        const { session } = await resetAgentSession({ agentId: 'agt_otto' });

        // The notice lands in the agent's built-in DM (bootstrapped with
        // the agent), the agent's home surface.
        const responses = listResponses('cht_agt_otto_dm', { limit: 10 });
        expect(responses.responses).toHaveLength(1);
        const activities = listActivityForResponses(
            responses.responses.map((response) => response.id),
            getDb()
        );
        expect(activities).toHaveLength(1);
        const notice = (
            activities[0]?.metadata as {
                runtime?: { notice?: { kind?: string; sessionId?: string } };
            }
        ).runtime?.notice;
        expect(notice?.kind).toBe('new_session');
        expect(notice?.sessionId).toBe(session.id);
    });
});
