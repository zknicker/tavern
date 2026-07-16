import { describe, expect, test } from 'bun:test';
import { parseWidgetPayload, widgetFallbackText } from '../contracts.ts';
import { widgetPagePropsSchema } from './contracts.ts';

describe('page widget contracts', () => {
    test('accepts a workspace-relative tsx path', () => {
        const props = widgetPagePropsSchema.parse({ path: 'workbench/pages/report.tsx' });

        expect(props).toEqual({ path: 'workbench/pages/report.tsx' });
    });

    test('clamps height into the 120-1200 range and rounds it', () => {
        expect(widgetPagePropsSchema.parse({ height: 20, path: 'a.tsx' }).height).toBe(120);
        expect(widgetPagePropsSchema.parse({ height: 9000, path: 'a.tsx' }).height).toBe(1200);
        expect(widgetPagePropsSchema.parse({ height: 480.6, path: 'a.tsx' }).height).toBe(481);
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
            expect(widgetPagePropsSchema.safeParse({ path }).success).toBe(false);
        }
    });

    test('rejects non-tsx extensions', () => {
        for (const path of ['page.ts', 'page.jsx', 'page.html', 'page.tsx.txt', 'notes.md']) {
            expect(widgetPagePropsSchema.safeParse({ path }).success).toBe(false);
        }
        expect(widgetPagePropsSchema.safeParse({ path: 'PAGE.TSX' }).success).toBe(true);
    });

    test('rejects unknown props', () => {
        expect(
            widgetPagePropsSchema.safeParse({ path: 'a.tsx', src: 'https://evil.example' }).success
        ).toBe(false);
    });

    test('parseWidgetPayload produces the page render envelope', () => {
        const parsed = parseWidgetPayload('page', {
            height: 600,
            path: 'workbench/pages/report.tsx',
        });

        expect(parsed.name).toBe('page');
        expect(parsed.render.component).toBe('tavern.widget.page');
        expect(parsed.render.target).toBe('chat.inline');
        expect(parsed.fallbackText).toBe('Page: workbench/pages/report.tsx');
    });

    test('fallback text prefers title over the path summary', () => {
        expect(widgetFallbackText('page', { path: 'a.tsx', title: 'Report' })).toBe('Report');
        expect(widgetFallbackText('page', {})).toBe('Page');
    });
});
