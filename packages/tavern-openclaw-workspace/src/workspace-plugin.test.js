import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

describe('Tavern Workspace plugin', () => {
    it('does not expose agent notes tools', () => {
        expect(readManifestToolNames()).toEqual([]);
    });
});

function readManifestToolNames() {
    const dirname = path.dirname(fileURLToPath(import.meta.url));
    const manifestPath = path.join(dirname, '..', 'openclaw.plugin.json');
    return JSON.parse(readFileSync(manifestPath, 'utf8')).contracts.tools;
}
