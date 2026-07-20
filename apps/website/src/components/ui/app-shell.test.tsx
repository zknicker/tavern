import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { AppShellContentHeader, AppShellDragRegion } from './app-shell.tsx';

describe('AppShell drag regions', () => {
    test('marks the transparent top strip as a native drag region', () => {
        const markup = renderToStaticMarkup(<AppShellDragRegion />);

        expect(markup).toContain('data-slot="app-shell-drag-region"');
        expect(markup).toContain('data-window-drag-region=""');
    });

    test('marks content headers as draggable while child controls can opt out', () => {
        const markup = renderToStaticMarkup(
            <AppShellContentHeader>
                <button className="no-drag" type="button">
                    Save
                </button>
            </AppShellContentHeader>
        );

        expect(markup).toContain('data-slot="app-shell-content-header"');
        expect(markup).toContain('data-window-drag-region=""');
        expect(markup).toContain('class="no-drag"');
    });
});
