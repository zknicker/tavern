import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleHermesProxyRequest } from './proxy';

const hermesMock = vi.hoisted(() => ({
    close: vi.fn(),
    listSkills: vi.fn(),
    listSessionPreviews: vi.fn(),
    listToolsets: vi.fn(),
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

    it('returns a non-2xx response for unsupported Hermes agent patches', async () => {
        const response = await handleHermesProxyRequest(
            new Request('http://runtime.test/agents/agt_hermes/avatar', {
                body: JSON.stringify({ avatar: null }),
                method: 'PATCH',
            })
        );

        expect(response?.status).toBe(502);
        await expect(response?.json()).resolves.toMatchObject({
            code: 'unsupported_hermes_surface',
        });
    });
});
