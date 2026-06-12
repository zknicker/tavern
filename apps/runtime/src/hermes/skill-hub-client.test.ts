import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { HermesHttp } from './http';
import { SkillHubClient } from './skill-hub-client';

// Engine-shaped fixtures pinned to hermes_cli/web_server.py responses so the
// snake_case mapping stays honest without a live engine.
const previewFixture = {
    description: 'PDF tools',
    files: ['SKILL.md', 'scripts/fill.py'],
    identifier: 'anthropics/skills/skills/pdf',
    name: 'pdf',
    repo: 'anthropics/skills',
    skill_md: '# PDF skill',
    source: 'github',
    tags: [],
    trust_level: 'trusted',
};

const scanFixture = {
    findings: [
        {
            category: 'exec',
            description: 'Runs a shell command',
            file: 'scripts/fill.py',
            line: 12,
            severity: 'medium',
        },
    ],
    identifier: 'anthropics/skills/skills/pdf',
    name: 'pdf',
    policy: 'ask',
    policy_reason: 'Community skill with findings.',
    severity_counts: { critical: 0, high: 0, low: 0, medium: 1 },
    source: 'github',
    summary: '1 finding',
    trust_level: 'trusted',
    verdict: 'warn',
};

describe('SkillHubClient', () => {
    let server: Server | null = null;

    afterEach(() => {
        server?.close();
        server = null;
    });

    async function startFixture(
        handler: (pathname: string, request: { method: string }) => unknown
    ) {
        server = createServer((request, response) => {
            const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
            const payload = handler(pathname, { method: request.method ?? 'GET' });
            response.setHeader('content-type', 'application/json');
            response.end(JSON.stringify(payload));
        });
        await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
        const address = server?.address();
        const port = typeof address === 'object' && address ? address.port : 0;
        return new SkillHubClient(
            new HermesHttp({ baseUrl: `http://127.0.0.1:${port}`, token: null })
        );
    }

    it('maps the preview SKILL.md and file manifest', async () => {
        const client = await startFixture(() => previewFixture);
        const preview = await client.preview('anthropics/skills/skills/pdf');

        expect(preview.skillMd).toBe('# PDF skill');
        expect(preview.files).toEqual(['SKILL.md', 'scripts/fill.py']);
    });

    it('maps the scan verdict, policy, and findings', async () => {
        const client = await startFixture(() => scanFixture);
        const scan = await client.scan('anthropics/skills/skills/pdf');

        expect(scan.policy).toBe('ask');
        expect(scan.findings[0]).toEqual({
            category: 'exec',
            description: 'Runs a shell command',
            file: 'scripts/fill.py',
            line: 12,
            severity: 'medium',
        });
    });
});
