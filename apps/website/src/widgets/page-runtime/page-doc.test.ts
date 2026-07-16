import { describe, expect, test } from 'bun:test';
import { buildPageSrcDoc } from './page-doc.ts';

const input = {
    runtimeCss: ':root{--x:1}',
    runtimeJs: 'window.tavernPageRuntime={render(){}};',
    scheme: 'dark' as const,
    source: 'export default function Page() { return <p>hi</p>; }',
};

describe('page srcDoc', () => {
    test('embeds styles, runtime, and the source literal', () => {
        const doc = buildPageSrcDoc(input);

        expect(doc).toContain('<style>:root{--x:1}</style>');
        expect(doc).toContain(input.runtimeJs);
        expect(doc).toContain('window.tavernPageRuntime.render("export default function Page()');
        expect(doc).toContain('<div id="page-root"></div>');
    });

    test('follows the app scheme through the html class and data-theme', () => {
        expect(buildPageSrcDoc(input)).toContain('<html class="dark" data-theme="dark">');
        expect(buildPageSrcDoc({ ...input, scheme: 'light' })).toContain(
            '<html data-theme="light">'
        );
    });

    test('a source cannot break out of the inline script', () => {
        const doc = buildPageSrcDoc({
            ...input,
            source: 'const evil = "</script><script>alert(1)</script>";',
        });

        expect(doc).not.toContain('</script><script>alert(1)');
        expect(doc).toContain('\\u003c/script');
    });

    test('runtime script survives </script sequences in string literals', () => {
        const doc = buildPageSrcDoc({ ...input, runtimeJs: 'const s = "</script>";' });

        expect(doc).toContain('const s = "<\\/script>";');
    });
});
