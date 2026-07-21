import { describe, expect, test } from 'bun:test';
import { appendComposerInsert } from '../../commands/chat-composer-insert.ts';
import { buildQuoteInsert } from './selection-quote.tsx';

describe('selection quote', () => {
    test('quotes every selected line and appends the grotto:// source link', () => {
        const insert = buildQuoteInsert('first line\nsecond line', {
            href: 'grotto://wiki/Projects/Alpha.md',
            label: 'Projects/Alpha.md',
        });
        expect(insert).toBe(
            '> first line\n> second line\n\n[Projects/Alpha.md](grotto://wiki/Projects/Alpha.md)\n\n'
        );
    });

    test('composer insert appends below existing draft text', () => {
        expect(appendComposerInsert('', '> q\n\n')).toBe('> q\n\n');
        expect(appendComposerInsert('draft text\n', '> q\n\n[a](b)\n\n')).toBe(
            'draft text\n\n> q\n\n[a](b)\n\n'
        );
    });
});
