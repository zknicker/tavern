import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { generatedInstructionFileName, registerAgentWorkspace } from '../workspace/instructions';
import { agentNotesFileName } from '../workspace/managed-instructions';
import { handleHermesProxyRequest } from './proxy';

const hermesMock = vi.hoisted(() => ({
    close: vi.fn(),
    getAgentFile: vi.fn(),
    getSkill: vi.fn(),
    listSkills: vi.fn(),
    listSessionPreviews: vi.fn(),
    listToolsets: vi.fn(),
    saveAgentFile: vi.fn(),
    updateAgentName: vi.fn(),
    updateSkillEnabled: vi.fn(),
    updateToolsetEnabled: vi.fn(),
}));

vi.mock('../hermes/local-client', () => ({
    createLocalHermesClient: () => hermesMock,
}));

describe('Hermes proxy routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    it('routes session previews before treating previews as a session key', async () => {
        hermesMock.listSessionPreviews.mockResolvedValueOnce({
            previews: [{ items: [], key: 'agent:main:tavern:cht_1', status: 'empty' }],
            ts: 1,
        });

        const response = await handleHermesProxyRequest(
            new Request(
                'http://runtime.test/hermes/sessions/previews?key=agent%3Amain%3Atavern%3Acht_1&limit=2&maxChars=140'
            )
        );

        expect(response?.status).toBe(200);
        expect(hermesMock.listSessionPreviews).toHaveBeenCalledWith({
            keys: ['agent:main:tavern:cht_1'],
            limit: 2,
            maxChars: 140,
        });
        expect(hermesMock.close).toHaveBeenCalled();
    });

    it('routes supported Hermes agent setting patches to the adapter', async () => {
        hermesMock.updateAgentName.mockResolvedValueOnce({
            config: { agent: { name: 'Hermes' } },
            hash: 'agent-name:Hermes',
            issues: [],
            raw: '{}',
            valid: true,
        });

        const response = await handleHermesProxyRequest(
            new Request('http://runtime.test/agents/agt_hermes/name', {
                body: JSON.stringify({ name: 'Hermes' }),
                method: 'PATCH',
            })
        );

        expect(response?.status).toBe(200);
        expect(hermesMock.updateAgentName).toHaveBeenCalledWith('agt_hermes', { name: 'Hermes' });
    });

    it('returns the managed Hermes skill list without Codex inventory merging', async () => {
        hermesMock.listSkills.mockResolvedValueOnce({
            skills: [{ id: 'browser', name: 'browser' }],
        });

        const response = await handleHermesProxyRequest(
            new Request('http://runtime.test/skills?agentId=agt_hermes')
        );

        expect(response?.status).toBe(200);
        expect(hermesMock.listSkills).toHaveBeenCalledWith({ agentId: 'agt_hermes' });
        await expect(response?.json()).resolves.toEqual({
            skills: [{ id: 'browser', name: 'browser' }],
        });
    });

    it('routes skill enablement updates to managed Hermes', async () => {
        hermesMock.updateSkillEnabled.mockResolvedValueOnce({
            contentMarkdown: '',
            files: [],
            id: 'browser',
            installSource: null,
            name: 'browser',
        });

        const response = await handleHermesProxyRequest(
            new Request('http://runtime.test/skills/browser/enabled', {
                body: JSON.stringify({ enabled: false }),
                method: 'PUT',
            })
        );

        expect(response?.status).toBe(200);
        expect(hermesMock.updateSkillEnabled).toHaveBeenCalledWith('browser', {
            enabled: false,
        });
    });

    it('routes skill detail reads to managed Hermes', async () => {
        hermesMock.getSkill.mockResolvedValueOnce({
            contentMarkdown: '# Browser\n',
            files: [{ path: 'SKILL.md', sizeBytes: 10 }],
            id: 'browser',
            installSource: null,
            name: 'browser',
        });

        const response = await handleHermesProxyRequest(
            new Request('http://runtime.test/skills/browser')
        );

        expect(response?.status).toBe(200);
        expect(hermesMock.getSkill).toHaveBeenCalledWith('browser');
        await expect(response?.json()).resolves.toMatchObject({
            contentMarkdown: '# Browser\n',
            id: 'browser',
            name: 'browser',
        });
    });

    it('does not treat nested skill routes as skill detail reads', async () => {
        const response = await handleHermesProxyRequest(
            new Request('http://runtime.test/skills/browser/config')
        );

        expect(response).toBeNull();
        expect(hermesMock.getSkill).not.toHaveBeenCalled();
    });

    it('returns the managed Hermes toolset list', async () => {
        hermesMock.listToolsets.mockResolvedValueOnce({
            toolsets: [
                {
                    configured: true,
                    enabled: true,
                    id: 'web',
                    label: 'Web',
                    name: 'web',
                    tools: ['search.web'],
                },
            ],
        });

        const response = await handleHermesProxyRequest(
            new Request('http://runtime.test/toolsets')
        );

        expect(response?.status).toBe(200);
        expect(hermesMock.listToolsets).toHaveBeenCalledWith();
        await expect(response?.json()).resolves.toEqual({
            toolsets: [
                {
                    configured: true,
                    enabled: true,
                    id: 'web',
                    label: 'Web',
                    name: 'web',
                    tools: ['search.web'],
                },
            ],
        });
    });

    it('routes toolset enablement updates to managed Hermes', async () => {
        hermesMock.updateToolsetEnabled.mockResolvedValueOnce({
            configured: true,
            enabled: false,
            id: 'web',
            label: 'Web',
            name: 'web',
            tools: ['search.web'],
        });

        const response = await handleHermesProxyRequest(
            new Request('http://runtime.test/toolsets/web/enabled', {
                body: JSON.stringify({ enabled: false }),
                method: 'PUT',
            })
        );

        expect(response?.status).toBe(200);
        expect(hermesMock.updateToolsetEnabled).toHaveBeenCalledWith('web', {
            enabled: false,
        });
    });

    it('regenerates AGENTS.md when NOTES.md is saved', async () => {
        const workspaceDir = await mkdtemp(path.join(tmpdir(), 'tavern-proxy-workspace-'));
        const notesPath = path.join(workspaceDir, agentNotesFileName);
        const agentsPath = path.join(workspaceDir, generatedInstructionFileName);
        registerAgentWorkspace(getDb(), {
            agentId: 'agt_hermes',
            agentName: 'Hermes',
            workspaceDir,
        });
        hermesMock.saveAgentFile.mockImplementation(
            async (_agentId: string, _path: string, input: { content: string }) => {
                await writeFile(notesPath, input.content);
                return { content: input.content, path: agentNotesFileName };
            }
        );

        try {
            const response = await handleHermesProxyRequest(
                new Request('http://runtime.test/agents/agt_hermes/files/NOTES.md', {
                    body: JSON.stringify({ content: '# Notes\n\nUser notes stay.\n' }),
                    method: 'PUT',
                })
            );

            expect(response?.status).toBe(200);
            const generated = await readFile(agentsPath, 'utf8');
            expect(generated).toMatch(/^<!-- GENERATED BY TAVERN/u);
            expect(generated).toContain('You are Hermes, the resident agent of Tavern');
            expect(generated).toContain('User notes stay.');
        } finally {
            await rm(workspaceDir, { force: true, recursive: true });
        }
    });

    it('returns a non-2xx response for unsupported Hermes agent patches', async () => {
        const response = await handleHermesProxyRequest(
            new Request('http://runtime.test/agents/agt_hermes/legacy-setting', {
                body: JSON.stringify({ enabled: true }),
                method: 'PATCH',
            })
        );

        expect(response?.status).toBe(502);
        await expect(response?.json()).resolves.toMatchObject({
            code: 'unsupported_hermes_surface',
        });
    });
});
