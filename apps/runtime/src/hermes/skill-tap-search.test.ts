import fs from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearTapSkillCache, listTapSkills, searchTapSkills } from './skill-tap-search';
import { addSkillHubTap } from './skill-taps';

const merchbaseSkillMd = `---
name: merchbase
description: Manage MerchBase products and listings
---

# MerchBase
`;

const rankwranglerSkillMd = `---
name: rankwrangler
description: "Track keyword rankings"
---
`;

describe('skill tap search', () => {
    let home: string;
    let server: Server | null = null;
    let requests: string[] = [];

    beforeEach(async () => {
        home = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-tap-search-'));
        requests = [];
        clearTapSkillCache();
    });

    afterEach(async () => {
        server?.close();
        server = null;
        clearTapSkillCache();
        await fs.rm(home, { force: true, recursive: true });
    });

    async function startGitHubFixture() {
        server = createServer((request, response) => {
            const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
            requests.push(pathname);
            response.setHeader('content-type', 'application/json');
            if (pathname === '/repos/merchbaseco/skills/contents/skills') {
                response.end(
                    JSON.stringify([
                        { name: 'merchbase', type: 'dir' },
                        { name: 'rankwrangler', type: 'dir' },
                        { name: 'README.md', type: 'file' },
                    ])
                );
                return;
            }
            if (pathname === '/repos/merchbaseco/skills/contents/skills/merchbase/SKILL.md') {
                response.end(merchbaseSkillMd);
                return;
            }
            if (pathname === '/repos/merchbaseco/skills/contents/skills/rankwrangler/SKILL.md') {
                response.end(rankwranglerSkillMd);
                return;
            }
            response.statusCode = 404;
            response.end('{}');
        });
        await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
        const address = server?.address();
        const port = typeof address === 'object' && address ? address.port : 0;
        return `http://127.0.0.1:${port}`;
    }

    it('lists tap repo skills with frontmatter descriptions and hub identifiers', async () => {
        await addSkillHubTap({ repo: 'merchbaseco/skills' }, { home });
        const apiBaseUrl = await startGitHubFixture();

        const items = await listTapSkills({ apiBaseUrl, cacheTtlMs: 0, home, token: null });

        expect(items).toEqual([
            {
                description: 'Manage MerchBase products and listings',
                identifier: 'merchbaseco/skills/skills/merchbase',
                name: 'merchbase',
                repo: 'merchbaseco/skills',
                source: 'github',
                tags: [],
                trustLevel: 'community',
            },
            {
                description: 'Track keyword rankings',
                identifier: 'merchbaseco/skills/skills/rankwrangler',
                name: 'rankwrangler',
                repo: 'merchbaseco/skills',
                source: 'github',
                tags: [],
                trustLevel: 'community',
            },
        ]);
    });

    it('filters by name and description text', async () => {
        await addSkillHubTap({ repo: 'merchbaseco/skills' }, { home });
        const apiBaseUrl = await startGitHubFixture();
        const options = { apiBaseUrl, cacheTtlMs: 0, home, token: null };

        expect(await searchTapSkills('merchbase', options)).toHaveLength(1);
        expect(await searchTapSkills('keyword rankings', options)).toHaveLength(1);
        expect(await searchTapSkills('nope', options)).toHaveLength(0);
    });

    it('serves repeat reads from the cache within the TTL', async () => {
        await addSkillHubTap({ repo: 'merchbaseco/skills' }, { home });
        const apiBaseUrl = await startGitHubFixture();
        const options = { apiBaseUrl, cacheTtlMs: 60_000, home, token: null };

        await listTapSkills(options);
        const requestsAfterFirst = requests.length;
        await listTapSkills(options);

        expect(requests.length).toBe(requestsAfterFirst);
    });

    it('returns no items when the repo is unreachable', async () => {
        await addSkillHubTap({ repo: 'merchbaseco/private' }, { home });
        const apiBaseUrl = await startGitHubFixture();

        const items = await listTapSkills({ apiBaseUrl, cacheTtlMs: 0, home, token: null });

        expect(items).toEqual([]);
    });
});
