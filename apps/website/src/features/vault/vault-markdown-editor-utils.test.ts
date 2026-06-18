import { describe, expect, test } from 'bun:test';
import { applyMarkdownCommand, getMarkdownStats } from './vault-markdown-editor-utils.ts';

describe('applyMarkdownCommand', () => {
    test('wraps selected text', () => {
        expect(applyMarkdownCommand('hello world', { end: 11, start: 6 }, 'bold')).toMatchObject({
            selection: { end: 13, start: 8 },
            value: 'hello **world**',
        });
    });

    test('inserts wikilink placeholder when selection is empty', () => {
        expect(applyMarkdownCommand('see ', { end: 4, start: 4 }, 'wikilink')).toMatchObject({
            selection: { end: 15, start: 6 },
            value: 'see [[Page name]]',
        });
    });

    test('prefixes every selected non-empty line', () => {
        expect(
            applyMarkdownCommand('one\ntwo\n\nthree', { end: 7, start: 0 }, 'check-list')
        ).toMatchObject({
            value: '- [ ] one\n- [ ] two\n\nthree',
        });
    });

    test('replaces existing heading prefix', () => {
        expect(applyMarkdownCommand('## Title', { end: 8, start: 0 }, 'heading-3')).toMatchObject({
            value: '### Title',
        });
    });
});

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
