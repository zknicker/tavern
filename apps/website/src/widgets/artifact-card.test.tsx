import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { WidgetArtifactCard } from './artifact-card.tsx';

test('renders a compact card with title, kind, and open affordance', () => {
    const markup = renderToStaticMarkup(
        <WidgetArtifactCard props={{ path: 'workbench/pages/fleet.tsx', title: 'Fleet status' }} />
    );

    expect(markup).toContain('Fleet status');
    expect(markup).toContain('TSX page · workbench/pages/fleet.tsx');
    expect(markup).toContain('Open');
    expect(markup).not.toContain('<iframe');
});

test('falls back to the file name when no title is given', () => {
    const markup = renderToStaticMarkup(
        <WidgetArtifactCard props={{ path: 'workbench/pages/fleet.tsx' }} />
    );

    expect(markup).toContain('fleet.tsx');
});

test('is inert outside an artifact pane context', () => {
    const markup = renderToStaticMarkup(
        <WidgetArtifactCard props={{ path: 'workbench/pages/fleet.tsx' }} />
    );

    expect(markup).toContain('cursor-default');
    expect(markup).not.toContain('cursor-pointer');
});
