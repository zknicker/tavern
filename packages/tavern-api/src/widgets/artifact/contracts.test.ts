import { describe, expect, test } from 'bun:test';
import { parseWidgetPayload, widgetFallbackText, widgetFenceLabel } from '../contracts.ts';
import { widgetArtifactPropsSchema } from './contracts.ts';

describe('artifact widget contracts', () => {
    test('accepts a workspace-relative tsx path', () => {
        const props = widgetArtifactPropsSchema.parse({ path: 'workbench/pages/report.tsx' });

        expect(props).toEqual({ path: 'workbench/pages/report.tsx' });
    });

    test('rejects traversal, absolute, and backslash paths', () => {
        for (const path of [
            '../outside.tsx',
            'workbench/../../outside.tsx',
            '/etc/passwd.tsx',
            'workbench\\page.tsx',
            './page.tsx',
            'workbench//page.tsx',
        ]) {
            expect(widgetArtifactPropsSchema.safeParse({ path }).success).toBe(false);
        }
    });

    test('rejects non-tsx extensions', () => {
        for (const path of ['page.ts', 'page.jsx', 'page.html', 'page.tsx.txt', 'notes.md']) {
            expect(widgetArtifactPropsSchema.safeParse({ path }).success).toBe(false);
        }
        expect(widgetArtifactPropsSchema.safeParse({ path: 'PAGE.TSX' }).success).toBe(true);
    });

    test('rejects unknown props, height above all (pane owns sizing)', () => {
        expect(
            widgetArtifactPropsSchema.safeParse({ path: 'a.tsx', src: 'https://evil.example' })
                .success
        ).toBe(false);
        expect(widgetArtifactPropsSchema.safeParse({ height: 600, path: 'a.tsx' }).success).toBe(
            false
        );
    });

    test('parseWidgetPayload produces the artifact render envelope', () => {
        const parsed = parseWidgetPayload('artifact', { path: 'workbench/pages/report.tsx' });

        expect(parsed.name).toBe('artifact');
        expect(parsed.render.component).toBe('tavern.widget.artifact');
        expect(parsed.render.target).toBe('chat.inline');
        expect(parsed.fallbackText).toBe('Artifact: workbench/pages/report.tsx');
    });

    test('fallback text prefers title over the path summary', () => {
        expect(widgetFallbackText('artifact', { path: 'a.tsx', title: 'Report' })).toBe('Report');
        expect(widgetFallbackText('artifact', {})).toBe('Artifact');
    });

    test('the fence label is bare artifact, not widget-prefixed', () => {
        expect(widgetFenceLabel('artifact')).toBe('artifact');
        expect(widgetFenceLabel('bar-chart')).toBe('widget:bar-chart');
    });
});
