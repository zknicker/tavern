import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { WikiMarkdownViewer } from './wiki-markdown-viewer.tsx';

test('WikiMarkdownViewer renders common Markdown blocks', () => {
    const markup = renderToStaticMarkup(
        <WikiMarkdownViewer
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

test('WikiMarkdownViewer renders navigable double-bracket links when navigation is provided', () => {
    const markup = renderToStaticMarkup(
        <WikiMarkdownViewer
            onNavigate={() => {
                // navigation handled by the Wiki container
            }}
            value="See [[alpha|Alpha Page]] ([Alpha Page](../memory/alpha.md)) and [docs](https://example.com)."
        />
    );

    assert.match(markup, /<button[^>]*>Alpha Page<\/button>/);
    assert.match(markup, /<button[^>]*>.*Alpha Page.*<\/button>.*<button/su);
    assert.match(markup, /href="https:\/\/example.com"/);
});

test('WikiMarkdownViewer keeps double-bracket links inert without a navigation handler', () => {
    const markup = renderToStaticMarkup(<WikiMarkdownViewer value="See [[alpha|Alpha Page]]." />);

    assert.doesNotMatch(markup, /<button/);
    assert.match(markup, /Alpha Page/);
});
