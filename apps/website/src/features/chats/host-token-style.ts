/**
 * Host token injection for sandboxed artifact frames. The opaque-origin
 * iframe cannot see app stylesheets, so we read the resolved values of the
 * public design tokens (styles/tokens.css) off the live document and inject
 * them as a `:root` block. Values are theme-resolved at read time; callers
 * re-render the srcDoc when the app scheme flips.
 */

// The agent-facing token vocabulary: colors, surfaces, type, and radii an
// artifact page can reference. App-shell tokens (sidebar, topbar, chrome)
// stay host-private.
const hostTokenNames = [
    '--font-sans',
    '--font-heading',
    '--font-mono',
    '--app-ui-font-size',
    '--app-code-font-size',
    '--background',
    '--foreground',
    '--card',
    '--card-foreground',
    '--popover',
    '--popover-foreground',
    '--primary',
    '--primary-foreground',
    '--secondary',
    '--secondary-foreground',
    '--muted',
    '--muted-foreground',
    '--subtle',
    '--accent',
    '--accent-foreground',
    '--brand',
    '--brand-foreground',
    '--brand-muted',
    '--brand-muted-foreground',
    '--destructive',
    '--destructive-foreground',
    '--border',
    '--border-strong',
    '--input',
    '--ring',
    '--surface-1',
    '--surface-2',
    '--surface-3',
    '--surface-4',
    '--surface-5',
    '--surface-6',
    '--surface-7',
    '--surface-8',
    '--surface-shadow-1',
    '--surface-shadow-2',
    '--surface-shadow-3',
    '--surface-shadow-4',
    '--success',
    '--success-foreground',
    '--success-bg',
    '--warning',
    '--warning-foreground',
    '--warning-bg',
    '--error',
    '--error-foreground',
    '--error-bg',
    '--info',
    '--info-foreground',
    '--info-bg',
    '--radius-sm',
    '--radius-md',
    '--radius-lg',
    '--radius-xl',
    '--radius-2xl',
] as const;

/** Resolved `:root` token block for the current app theme, or '' outside a browser. */
export function readHostTokenCss(scheme: 'dark' | 'light'): string {
    if (typeof document === 'undefined' || typeof window.getComputedStyle !== 'function') {
        return '';
    }

    const computed = window.getComputedStyle(document.documentElement);
    const declarations = hostTokenNames
        .map((name) => ({ name, value: computed.getPropertyValue(name).trim() }))
        .filter((token) => token.value.length > 0)
        .map((token) => `${token.name}:${token.value};`);

    return `:root{color-scheme:${scheme};${declarations.join('')}}`;
}

/**
 * Inject the token block into an artifact document without disturbing its
 * markup: after the opening <head> when present, otherwise prepended (the
 * parser hoists a leading <style> into head).
 */
export function injectHostTokenStyle(html: string, tokenCss: string): string {
    if (tokenCss.length === 0) {
        return html;
    }

    const styleTag = `<style data-tavern-tokens>${tokenCss}</style>`;
    const headMatch = /<head[^>]*>/iu.exec(html);

    if (headMatch) {
        const insertAt = headMatch.index + headMatch[0].length;
        return `${html.slice(0, insertAt)}${styleTag}${html.slice(insertAt)}`;
    }

    return `${styleTag}${html}`;
}
