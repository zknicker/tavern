import { describe, expect, test } from 'bun:test';
import { getMarkdownStats } from './vault-markdown-editor-utils.ts';

describe('getMarkdownStats', () => {
    test('counts words, characters, lines, and links', () => {
        expect(getMarkdownStats('Hello [[Vault]]\n[Docs](https://example.com)')).toEqual({
            characters: 43,
            lines: 2,
            links: 2,
            words: 3,
        });
    });
});
