import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { HermesHttp } from './http';
import { SkillHubClient } from './skill-hub-client';

// Engine-shaped fixtures pinned to hermes_cli/web_server.py responses so the
// snake_case mapping stays honest without a live engine.
const sourcesFixture = {
    featured: [
        {
            description: 'Manage MerchBase products',
            identifier: 'merchbaseco/skills/skills/merchbase',
            name: 'merchbase',
            repo: 'merchbaseco/skills',
            source: 'github',
            tags: ['products'],
            trust_level: 'community',
        },
    ],
    index_available: true,
    installed: {
        'merchbaseco/skills/skills/merchbase': {
            name: 'merchbase',
            scan_verdict: 'clean',
            trust_level: 'community',
        },
    },
    sources: [
        { id: 'official', label: 'Official (Nous)' },
        { available: true, id: 'hermes-index', label: 'Hermes Index' },
        { id: 'github', label: 'GitHub', rate_limited: false },
    ],
};

const searchFixture = {
    installed: {},
    results: [
        {
            description: 'PDF tools',
            identifier: 'anthropics/skills/skills/pdf',
            name: 'pdf',
            repo: 'anthropics/skills',
            source: 'github',
            tags: [],
            trust_level: 'trusted',
        },
    ],
    source_counts: { clawhub: 0, github: 1 },
    timed_out: ['lobehub'],
};

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
            new HermesHttp({ baseUrl: `http://127.0.0.1:${port}`, token: null }),
            { pollIntervalMs: 5, timeoutMs: 2000 }
        );
    }

    it('maps the catalog sources, featured skills, and installed lock entries', async () => {
        const client = await startFixture(() => sourcesFixture);
        const catalog = await client.getCatalog();

        expect(catalog.indexAvailable).toBe(true);
        expect(catalog.sources).toHaveLength(3);
        expect(catalog.sources[1]).toEqual({
            available: true,
            id: 'hermes-index',
            label: 'Hermes Index',
        });
        expect(catalog.featured[0]?.trustLevel).toBe('community');
        expect(catalog.installed['merchbaseco/skills/skills/merchbase']?.scanVerdict).toBe('clean');
    });

    it('maps search results with source counts and timed out sources', async () => {
        const requestedPaths: string[] = [];
        const client = await startFixture((pathname) => {
            requestedPaths.push(pathname);
            return searchFixture;
        });
        const result = await client.search({ query: 'pdf' });

        expect(requestedPaths[0]).toBe('/api/skills/hub/search');
        expect(result.results[0]?.trustLevel).toBe('trusted');
        expect(result.sourceCounts.github).toBe(1);
        expect(result.timedOut).toEqual(['lobehub']);
    });

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

    it('waits for the install action to exit and returns the log tail', async () => {
        let statusPolls = 0;
        const client = await startFixture((pathname) => {
            if (pathname === '/api/skills/hub/install') {
                return { name: 'skills-install', ok: true, pid: 123 };
            }
            statusPolls += 1;
            return statusPolls < 3
                ? { exit_code: null, lines: [], name: 'skills-install', pid: 123, running: true }
                : {
                      exit_code: 0,
                      lines: ['Installed merchbase'],
                      name: 'skills-install',
                      pid: 123,
                      running: false,
                  };
        });
        const result = await client.install('merchbaseco/skills/skills/merchbase');

        expect(statusPolls).toBe(3);
        expect(result).toEqual({ exitCode: 0, log: ['Installed merchbase'], ok: true });
    });

    it('reports a failed install action with its exit code', async () => {
        const client = await startFixture((pathname) =>
            pathname === '/api/skills/hub/uninstall'
                ? { name: 'skills-uninstall', ok: true, pid: 5 }
                : {
                      exit_code: 1,
                      lines: ['No such skill'],
                      name: 'skills-uninstall',
                      pid: 5,
                      running: false,
                  }
        );
        const result = await client.uninstall('missing');

        expect(result.ok).toBe(false);
        expect(result.exitCode).toBe(1);
        expect(result.log).toEqual(['No such skill']);
    });
});
