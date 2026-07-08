import { describe, expect, test } from 'bun:test';
import { fromMdxEditorMarkdown, toMdxEditorMarkdown } from './wiki-memory-link-markdown.ts';

describe('Wiki wiki link markdown bridge', () => {
    test('renders aliased wiki links as editor links and roundtrips them', () => {
        const markdown =
            '[[Business/Amazon Merch/INDEX|Amazon Merch]] -- print-on-demand T-shirt business.';
        const editorMarkdown = toMdxEditorMarkdown(markdown);

        expect(editorMarkdown).toBe(
            '[Amazon Merch](/.tavern-wiki-link/Business%2FAmazon%20Merch%2FINDEX) -- print-on-demand T-shirt business.'
        );
        expect(fromMdxEditorMarkdown(editorMarkdown)).toBe(markdown);
    });

    test('keeps same-label wiki links compact when converting editor links back', () => {
        expect(
            fromMdxEditorMarkdown('[Projects/Tavern](/.tavern-wiki-link/Projects%2FTavern)')
        ).toBe('[[Projects/Tavern]]');
        expect(fromMdxEditorMarkdown('[Tavern](/.tavern-wiki-link/Projects%2FTavern)')).toBe(
            '[[Projects/Tavern|Tavern]]'
        );
    });

    test('does not render wiki links inside inline code or fenced code', () => {
        const markdown = ['`[[Code]]` and [[Page|Page Label]]', '```', '[[Raw]]', '```'].join('\n');
        const editorMarkdown = toMdxEditorMarkdown(markdown);

        expect(editorMarkdown).toBe(
            ['`[[Code]]` and [Page Label](/.tavern-wiki-link/Page)', '```', '[[Raw]]', '```'].join(
                '\n'
            )
        );
        expect(fromMdxEditorMarkdown(editorMarkdown)).toBe(markdown);
    });
});
