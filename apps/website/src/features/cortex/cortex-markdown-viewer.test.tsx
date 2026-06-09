import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { CortexMarkdownViewer } from './cortex-markdown-viewer.tsx';

test('CortexMarkdownViewer renders common wiki Markdown blocks', () => {
    const markup = renderToStaticMarkup(
        <CortexMarkdownViewer
            value={[
                '# Heading',
                '',
                'A **bold** paragraph with [a link](https://example.com).',
                '',
                '| File | Summary |',
                '|---|---|',
                '| [diet.md](diet.md) | Diet effects |',
                '',
                '- one',
                '- two',
                '',
                '> quoted note',
            ].join('\n')}
        />
    );

    assert.match(markup, /<table/);
    assert.match(markup, /<strong/);
    assert.match(markup, /href="https:\/\/example.com"/);
    assert.match(markup, /href="diet.md"/);
    assert.match(markup, /<ul/);
    assert.match(markup, /<blockquote/);
});
