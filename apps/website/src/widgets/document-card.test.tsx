import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { WidgetDocumentCard } from './document-card.tsx';

test('renders a compact Wiki document card', () => {
    const markup = renderToStaticMarkup(
        <WidgetDocumentCard props={{ path: 'projects/alpha.md', title: 'Alpha plan' }} />
    );

    expect(markup).toContain('Alpha plan');
    expect(markup).toContain('Wiki document · projects/alpha.md');
    expect(markup).toContain('Open');
});

test('falls back to the Markdown filename', () => {
    const markup = renderToStaticMarkup(
        <WidgetDocumentCard props={{ path: 'projects/alpha-plan.md' }} />
    );

    expect(markup).toContain('alpha-plan');
});
