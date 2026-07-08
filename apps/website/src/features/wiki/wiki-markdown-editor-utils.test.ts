import { describe, expect, test } from 'bun:test';
import { getMarkdownStats } from './wiki-markdown-editor-utils.ts';

describe('getMarkdownStats', () => {
    test('counts words, characters, lines, and links', () => {
        expect(getMarkdownStats('Hello [[Wiki]]\n[Docs](https://example.com)')).toEqual({
            characters: 52,
            lines: 2,
            links: 2,
            words: 3,
        });
    });
});
