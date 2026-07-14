import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { WidgetHtmlPreviewBody } from './html-preview.tsx';

const htmlFile = {
    binary: false,
    content: '<html><body><h1>Orbit demo</h1><script>console.log(1)</script></body></html>',
    mediaType: 'text/html',
    truncated: false,
};

test('renders a sandboxed opaque-origin iframe for complete html files', () => {
    const markup = renderToStaticMarkup(
        <WidgetHtmlPreviewBody
            file={htmlFile}
            height={600}
            path="workbench/demos/orbit.html"
            status="success"
        />
    );

    expect(markup).toContain('<iframe');
    expect(markup).toContain(
        'sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-scripts"'
    );
    expect(markup).not.toContain('allow-same-origin');
    expect(markup).toContain('height:600px');
    expect(markup).toContain('title="workbench/demos/orbit.html"');
    expect(markup).toContain('srcDoc="&lt;html&gt;');
});

test('refuses non-html, binary, and truncated reads', () => {
    const nonHtml = renderToStaticMarkup(
        <WidgetHtmlPreviewBody
            file={{ ...htmlFile, mediaType: 'text/plain' }}
            height={480}
            path="notes.html"
            status="success"
        />
    );
    const binary = renderToStaticMarkup(
        <WidgetHtmlPreviewBody
            file={{ ...htmlFile, binary: true }}
            height={480}
            path="notes.html"
            status="success"
        />
    );
    const truncated = renderToStaticMarkup(
        <WidgetHtmlPreviewBody
            file={{ ...htmlFile, truncated: true }}
            height={480}
            path="notes.html"
            status="success"
        />
    );

    expect(nonHtml).toContain('not previewable HTML');
    expect(nonHtml).not.toContain('<iframe');
    expect(binary).toContain('not previewable HTML');
    expect(binary).not.toContain('<iframe');
    expect(truncated).toContain('too large to preview');
    expect(truncated).not.toContain('<iframe');
});

test('shows loading and error states without an iframe', () => {
    const pending = renderToStaticMarkup(
        <WidgetHtmlPreviewBody file={undefined} height={480} path="a.html" status="pending" />
    );
    const error = renderToStaticMarkup(
        <WidgetHtmlPreviewBody file={undefined} height={480} path="a.html" status="error" />
    );

    expect(pending).toContain('Loading preview');
    expect(error).toContain('Unable to load this file');
    expect(pending).not.toContain('<iframe');
    expect(error).not.toContain('<iframe');
});
