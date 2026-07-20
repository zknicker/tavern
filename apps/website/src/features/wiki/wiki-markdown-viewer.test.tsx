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

test('WikiMarkdownViewer resolves page-relative attachment images', () => {
    const markup = renderToStaticMarkup(
        <WikiMarkdownViewer
            pagePath="projects/alpha.md"
            value="![Launch chart](./_attachments/launch-chart.png)"
        />
    );

    assert.match(markup, /Loading image: Launch chart/);
    assert.doesNotMatch(markup, /<img/u);
});

test('WikiMarkdownViewer separates an attachment image title from its path', () => {
    const markup = renderToStaticMarkup(
        <WikiMarkdownViewer
            pagePath="projects/alpha.md"
            value={'![Launch chart](./_attachments/launch-chart.png "Latest launch")'}
        />
    );

    assert.match(markup, /Loading image: Launch chart/);
    assert.match(markup, /title="Latest launch"/);
});

test('WikiMarkdownViewer parses a parenthesized image title through the outer delimiter', () => {
    const markup = renderToStaticMarkup(
        <WikiMarkdownViewer
            pagePath="projects/alpha.md"
            value="![Chart](./_attachments/chart.png (Latest chart))"
        />
    );

    assert.match(markup, /Loading image: Chart/);
    assert.match(markup, /title="Latest chart"/);
    assert.doesNotMatch(markup, /\)<\/p>/);
});

test('WikiMarkdownViewer leaves unresolved image sources inert', () => {
    const markup = renderToStaticMarkup(
        <WikiMarkdownViewer
            pagePath="projects/alpha.md"
            value="![Remote chart](https://example.com/chart.png)"
        />
    );

    assert.doesNotMatch(markup, /<img/u);
    assert.doesNotMatch(markup, /example\.com/u);
    assert.match(markup, /Image unavailable: Remote chart/u);
});
