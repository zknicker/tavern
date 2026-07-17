import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkspacePagePreview } from './chat-artifact-page-preview.tsx';

test('renders the page runtime in a sandboxed opaque-origin iframe', () => {
    const markup = renderToStaticMarkup(
        <WorkspacePagePreview
            content="export default function Page() { return <p>hi</p>; }"
            path="workbench/pages/fleet.tsx"
            truncated={false}
        />
    );

    expect(markup).toContain('<iframe');
    expect(markup).toContain(
        'sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-scripts"'
    );
    expect(markup).not.toContain('allow-same-origin');
    expect(markup).toContain('title="workbench/pages/fleet.tsx"');
    expect(markup).toContain('tavernPageRuntime');
});

test('refuses truncated reads without an iframe', () => {
    const markup = renderToStaticMarkup(
        <WorkspacePagePreview content="" path="workbench/pages/fleet.tsx" truncated={true} />
    );

    expect(markup).toContain('too large to render');
    expect(markup).not.toContain('<iframe');
});
