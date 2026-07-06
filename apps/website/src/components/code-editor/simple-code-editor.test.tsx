import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { SimpleCodeEditor } from './simple-code-editor.tsx';

const css = readFileSync(new URL('./simple-code-editor.css', import.meta.url), 'utf8');

describe('SimpleCodeEditor line numbers', () => {
    test('keeps editor rows on physical lines so the gutter stays aligned', () => {
        expect(css).toMatch(/white-space:\s*pre\s*!important;/);
        expect(css).not.toMatch(/white-space:\s*pre-wrap/);

        const markup = renderToStaticMarkup(
            <SimpleCodeEditor filePath="SOUL.md" readOnly value={'one long line\n\nsecond line'} />
        );

        expect(markup).toContain('min-width:max-content');
        expect(markup).toContain('overflow:visible');
        expect(markup).toContain('>1\n2\n3</pre>');
    });
});
