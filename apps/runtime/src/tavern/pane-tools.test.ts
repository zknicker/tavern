import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Tool } from 'ai';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { getChatPaneState } from '../pane/store.ts';
import { registerAgentWorkspace } from '../workspace/instructions.ts';
import { createChat } from './chat-api/index.ts';
import { createTavernPaneTools } from './pane-tools.ts';

describe('pane tools', () => {
    let workspaceDir: string;
    let wikiDir: string;
    let previousWikiPath: string | undefined;

    beforeEach(async () => {
        workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-pane-tools-ws-'));
        wikiDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-pane-tools-wiki-'));
        previousWikiPath = process.env.TAVERN_WIKI_PATH;
        process.env.TAVERN_WIKI_PATH = wikiDir;
        const db = initTestDb();
        ensureRuntimeSchema(db);

        await fs.mkdir(path.join(workspaceDir, 'workbench'), { recursive: true });
        await fs.writeFile(path.join(workspaceDir, 'workbench', 'report.md'), '# Report\n');
        await fs.writeFile(path.join(wikiDir, 'Launch Brief.md'), '# Launch Brief\n');

        registerAgentWorkspace(db, {
            agentId: 'agt_otto',
            agentName: 'Otto',
            workspaceDir,
        });
        const user = { id: 'usr_tavern', kind: 'user' as const, label: 'You', metadata: {} };
        const otto = {
            id: 'agt_otto',
            kind: 'agent' as const,
            label: 'Otto',
            metadata: { agentId: 'agt_otto' },
        };
        createChat({ id: 'cht_dm', kind: 'dm', participants: [user, otto], title: 'Otto' });
        createChat({ id: 'cht_other', kind: 'channel', participants: [user], title: 'No seat' });
    });

    afterEach(async () => {
        closeDb();
        if (previousWikiPath === undefined) {
            Reflect.deleteProperty(process.env, 'TAVERN_WIKI_PATH');
        } else {
            process.env.TAVERN_WIKI_PATH = previousWikiPath;
        }
        await Promise.all([
            fs.rm(workspaceDir, { force: true, recursive: true }),
            fs.rm(wikiDir, { force: true, recursive: true }),
        ]);
    });

    it('opens a workspace file tab and focuses it', async () => {
        const result = await runTool(paneTools().pane_open, {
            target: 'tavern://workspace/workbench/report.md',
        });

        expect(result).toEqual({
            opened: true,
            tabCount: 1,
            target: { kind: 'workspaceFile', path: 'workbench/report.md' },
        });
        expect(getChatPaneState('cht_dm')).toMatchObject({
            activeKey: 'workspaceFile:workbench/report.md',
            revision: 1,
            targets: [{ kind: 'workspaceFile', path: 'workbench/report.md' }],
        });
    });

    it('opens an existing Wiki page tab', async () => {
        const result = await runTool(paneTools().pane_open, {
            target: 'tavern://wiki/Launch%20Brief.md',
        });

        expect(result).toEqual({
            opened: true,
            tabCount: 1,
            target: { kind: 'wikiPage', path: 'Launch Brief.md' },
        });
    });

    it('focuses the existing tab when the same target opens again', async () => {
        const tools = paneTools();
        await runTool(tools.pane_open, { target: 'tavern://workspace/workbench/report.md' });
        await runTool(tools.pane_open, { target: 'tavern://wiki/Launch%20Brief.md' });

        const repeat = await runTool(tools.pane_open, {
            target: 'tavern://workspace/workbench/report.md',
        });

        expect(repeat).toMatchObject({ opened: true, tabCount: 2 });
        expect(getChatPaneState('cht_dm')).toMatchObject({
            activeKey: 'workspaceFile:workbench/report.md',
            revision: 3,
            targets: [
                { kind: 'workspaceFile', path: 'workbench/report.md' },
                { kind: 'wikiPage', path: 'Launch Brief.md' },
            ],
        });
    });

    it('rejects links outside the tavern:// pane scheme', async () => {
        const tools = paneTools();

        for (const target of [
            'https://example.com/report.md',
            'tavern://settings/agents',
            'tavern://workspace/../secret.md',
        ]) {
            await expect(runTool(tools.pane_open, { target })).resolves.toEqual({
                error: 'Target must be a tavern://workspace/<path> or tavern://wiki/<path> link.',
            });
        }
        expect(getChatPaneState('cht_dm').targets).toHaveLength(0);
    });

    it('rejects missing workspace files and Wiki pages', async () => {
        const tools = paneTools();

        await expect(
            runTool(tools.pane_open, { target: 'tavern://workspace/workbench/missing.md' })
        ).resolves.toEqual({ error: 'Workspace file "workbench/missing.md" does not exist.' });
        await expect(
            runTool(tools.pane_open, { target: 'tavern://wiki/Missing.md' })
        ).resolves.toEqual({ error: 'Wiki page "Missing.md" does not exist.' });
        expect(getChatPaneState('cht_dm').targets).toHaveLength(0);
    });

    it('rejects chats where the agent holds no seat', async () => {
        const tools = createTavernPaneTools({ agentId: 'agt_otto', chatId: 'cht_other' });

        await expect(
            runTool(tools.pane_open, { target: 'tavern://workspace/workbench/report.md' })
        ).resolves.toEqual({ error: 'You are not a participant of that chat.' });
        expect(getChatPaneState('cht_other').targets).toHaveLength(0);
    });
});

function paneTools() {
    return createTavernPaneTools({ agentId: 'agt_otto', chatId: 'cht_dm' });
}

async function runTool(candidate: Tool | undefined, args: Record<string, unknown>) {
    if (!candidate?.execute) {
        throw new Error('Tool is not executable.');
    }
    return await candidate.execute(args, {
        context: undefined,
        messages: [],
        toolCallId: 'tool_call_1',
    });
}
