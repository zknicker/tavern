import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { VaultMarkdownViewer } from './vault-markdown-viewer.tsx';

test('VaultMarkdownViewer renders common wiki Markdown blocks', () => {
    const markup = renderToStaticMarkup(
        <VaultMarkdownViewer
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

test('VaultMarkdownViewer renders navigable wiki links when navigation is provided', () => {
    const markup = renderToStaticMarkup(
        <VaultMarkdownViewer
            onNavigate={() => {
                // navigation handled by the Vault container
            }}
            value="See [[alpha|Alpha Page]] ([Alpha Page](../wiki/alpha.md)) and [docs](https://example.com)."
        />
    );

    assert.match(markup, /<button[^>]*>Alpha Page<\/button>/);
    assert.match(markup, /<button[^>]*>.*Alpha Page.*<\/button>.*<button/su);
    assert.match(markup, /href="https:\/\/example.com"/);
});

test('VaultMarkdownViewer keeps wiki links inert without a navigation handler', () => {
    const markup = renderToStaticMarkup(<VaultMarkdownViewer value="See [[alpha|Alpha Page]]." />);

    assert.doesNotMatch(markup, /<button/);
    assert.match(markup, /Alpha Page/);
});
