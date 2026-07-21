import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const formulaPublisherPath = path.resolve(import.meta.dirname, 'publish-homebrew-formula.mjs');

test('generated formula installs every external Runtime package', async () => {
    const source = await fs.readFile(formulaPublisherPath, 'utf8');

    assert.match(source, /share\/grotto\/node_modules\/@tavern\/sdk/u);
    assert.match(source, /share\/grotto\/node_modules\/@tobilu\/qmd/u);
    assert.match(source, /share\/grotto\/node_modules\/agent-browser/u);
});
