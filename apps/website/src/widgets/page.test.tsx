import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { WidgetPageBody } from './page.tsx';

const tsxFile = {
    binary: false,
    content: 'export default function Page() { return <p>hi</p>; }',
    language: 'tsx',
    truncated: false,
};

const runtime = { css: ':root{--x:1}', js: 'window.tavernPageRuntime={render(){}};' };

test('renders a sandboxed opaque-origin iframe for complete tsx files', () => {
    const markup = renderToStaticMarkup(
        <WidgetPageBody
            file={tsxFile}
            height={600}
            path="workbench/pages/report.tsx"
            runtime={runtime}
            scheme="dark"
            status="success"
        />
    );

    expect(markup).toContain('<iframe');
    expect(markup).toContain(
        'sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-scripts"'
    );
    expect(markup).not.toContain('allow-same-origin');
    expect(markup).toContain('height:600px');
    expect(markup).toContain('title="workbench/pages/report.tsx"');
    expect(markup).toContain('tavernPageRuntime');
});

test('refuses non-tsx, binary, and truncated reads', () => {
    const nonTsx = renderToStaticMarkup(
        <WidgetPageBody
            file={{ ...tsxFile, language: 'text' }}
            height={480}
            path="notes.tsx"
            runtime={runtime}
            scheme="dark"
            status="success"
        />
    );
    const binary = renderToStaticMarkup(
        <WidgetPageBody
            file={{ ...tsxFile, binary: true }}
            height={480}
            path="notes.tsx"
            runtime={runtime}
            scheme="dark"
            status="success"
        />
    );
    const truncated = renderToStaticMarkup(
        <WidgetPageBody
            file={{ ...tsxFile, truncated: true }}
            height={480}
            path="notes.tsx"
            runtime={runtime}
            scheme="dark"
            status="success"
        />
    );

    expect(nonTsx).toContain('not a renderable TSX page');
    expect(nonTsx).not.toContain('<iframe');
    expect(binary).toContain('not a renderable TSX page');
    expect(binary).not.toContain('<iframe');
    expect(truncated).toContain('too large to render');
    expect(truncated).not.toContain('<iframe');
});

test('shows loading and error states without an iframe', () => {
    const pending = renderToStaticMarkup(
        <WidgetPageBody
            file={undefined}
            height={480}
            path="a.tsx"
            runtime={runtime}
            scheme="dark"
            status="pending"
        />
    );
    const error = renderToStaticMarkup(
        <WidgetPageBody
            file={undefined}
            height={480}
            path="a.tsx"
            runtime={runtime}
            scheme="dark"
            status="error"
        />
    );

    expect(pending).toContain('Loading page');
    expect(error).toContain('Unable to load this file');
    expect(pending).not.toContain('<iframe');
    expect(error).not.toContain('<iframe');
});
