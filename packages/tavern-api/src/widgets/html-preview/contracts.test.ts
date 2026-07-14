import { describe, expect, test } from 'bun:test';
import { parseWidgetPayload, widgetFallbackText } from '../contracts.ts';
import { widgetHtmlPreviewPropsSchema } from './contracts.ts';

describe('html-preview widget contracts', () => {
    test('accepts a workspace-relative html path', () => {
        const props = widgetHtmlPreviewPropsSchema.parse({
            path: 'workbench/demos/report.html',
        });

        expect(props).toEqual({ path: 'workbench/demos/report.html' });
    });

    test('clamps height into the 120-1200 range and rounds it', () => {
        expect(widgetHtmlPreviewPropsSchema.parse({ height: 20, path: 'a.html' }).height).toBe(120);
        expect(widgetHtmlPreviewPropsSchema.parse({ height: 9000, path: 'a.html' }).height).toBe(
            1200
        );
        expect(widgetHtmlPreviewPropsSchema.parse({ height: 480.6, path: 'a.html' }).height).toBe(
            481
        );
    });

    test('rejects traversal, absolute, and backslash paths', () => {
        for (const path of [
            '../outside.html',
            'workbench/../../outside.html',
            '/etc/passwd.html',
            'workbench\\demo.html',
            './demo.html',
            'workbench//demo.html',
        ]) {
            expect(widgetHtmlPreviewPropsSchema.safeParse({ path }).success).toBe(false);
        }
    });

    test('rejects non-html extensions', () => {
        for (const path of ['notes.md', 'workbench/report.pdf', 'index.html.txt', 'page.xhtml']) {
            expect(widgetHtmlPreviewPropsSchema.safeParse({ path }).success).toBe(false);
        }
        expect(widgetHtmlPreviewPropsSchema.safeParse({ path: 'page.htm' }).success).toBe(true);
        expect(widgetHtmlPreviewPropsSchema.safeParse({ path: 'PAGE.HTML' }).success).toBe(true);
    });

    test('rejects unknown props', () => {
        expect(
            widgetHtmlPreviewPropsSchema.safeParse({ path: 'a.html', src: 'https://evil.example' })
                .success
        ).toBe(false);
    });

    test('parseWidgetPayload produces the html-preview render envelope', () => {
        const parsed = parseWidgetPayload('html-preview', {
            height: 600,
            path: 'workbench/demos/report.html',
        });

        expect(parsed.name).toBe('html-preview');
        expect(parsed.render.component).toBe('tavern.widget.html-preview');
        expect(parsed.render.target).toBe('chat.inline');
        expect(parsed.fallbackText).toBe('HTML preview: workbench/demos/report.html');
    });

    test('fallback text prefers title over the path summary', () => {
        expect(widgetFallbackText('html-preview', { path: 'a.html', title: 'Demo' })).toBe('Demo');
        expect(widgetFallbackText('html-preview', {})).toBe('HTML preview');
    });
});
