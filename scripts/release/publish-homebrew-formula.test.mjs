import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const formulaPublisherPath = path.resolve(import.meta.dirname, 'publish-homebrew-formula.mjs');

test('generated formula installs the complete external Runtime package tree', async () => {
    const source = await fs.readFile(formulaPublisherPath, 'utf8');

    assert.match(source, /\(share\/"grotto"\)\.install "share\/grotto\/node_modules"/u);
});

test('publisher stages the formula directory when the legacy formula is absent', async () => {
    const source = await fs.readFile(formulaPublisherPath, 'utf8');

    assert.match(source, /\['add', '-A', '--', 'Formula'\]/u);
});
