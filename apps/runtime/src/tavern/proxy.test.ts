import { describe, expect, it, vi } from 'vitest';
import { handleHermesProxyRequest } from './proxy';

const hermesMock = vi.hoisted(() => ({
    close: vi.fn(),
    listSessionPreviews: vi.fn(),
    updateAgentName: vi.fn(),
}));

vi.mock('../hermes/local-client', () => ({
    createLocalHermesClient: () => hermesMock,
}));

describe('Hermes proxy routes', () => {
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
