/**
 * Build the srcDoc for a widget:page iframe: Tavern tokens ride in via the
 * compiled page-runtime stylesheet, the theme follows the app scheme through
 * the html class/data-theme pair, and the page-runtime script compiles and
 * mounts the agent's TSX source entirely inside the opaque-origin sandbox.
 */

export interface PageDocInput {
    runtimeCss: string;
    runtimeJs: string;
    scheme: 'dark' | 'light';
    source: string;
}

export function buildPageSrcDoc({ runtimeCss, runtimeJs, scheme, source }: PageDocInput): string {
    const htmlAttributes =
        scheme === 'dark' ? ' class="dark" data-theme="dark"' : ' data-theme="light"';

    return [
        '<!doctype html>',
        `<html${htmlAttributes}>`,
        '<head>',
        '<meta charset="utf-8" />',
        '<meta name="viewport" content="width=device-width, initial-scale=1" />',
        `<style>${escapeInlineStyle(runtimeCss)}</style>`,
        '</head>',
        '<body>',
        '<div id="page-root"></div>',
        `<script>${escapeInlineScript(runtimeJs)}</script>`,
        `<script>window.tavernPageRuntime.render(${sourceLiteral(source)});</script>`,
        '</body>',
        '</html>',
    ].join('\n');
}

/** JSON string literal, hardened against closing the inline script tag. */
function sourceLiteral(source: string): string {
    return JSON.stringify(source).replace(/</gu, '\\u003c');
}

/** `</script` inside JS strings becomes `<\/script`, which parses identically. */
function escapeInlineScript(code: string): string {
    return code.replace(/<\/script/giu, '<\\/script');
}

function escapeInlineStyle(css: string): string {
    return css.replace(/<\/style/giu, '<\\2f style');
}
