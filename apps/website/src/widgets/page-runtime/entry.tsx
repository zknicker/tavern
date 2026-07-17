/**
 * Sandboxed page runtime: the entry point bundled by
 * `scripts/build-page-runtime.ts` into the self-contained script that runs
 * inside the artifact page iframe. It exposes `window.tavernPageRuntime.render`,
 * which compiles the agent's TSX source with sucrase, resolves only React and
 * `@tavern/kit`, and mounts the page — or renders the compile/render error
 * with the fenced source, never a partial page.
 */
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { createRoot } from 'react-dom/client';
import * as kit from '../../kit/index.ts';
import { buildPageModules, compilePageTsx, evaluatePageModule } from './compile.ts';

declare global {
    interface Window {
        tavernPageRuntime: { render: (source: string) => void };
    }
}

const pageModules = buildPageModules({
    jsxRuntime: jsxRuntime as unknown as Record<string, unknown>,
    kit: kit as unknown as Record<string, unknown>,
    react: React as unknown as Record<string, unknown>,
});

function render(source: string) {
    const mount = document.getElementById('page-root');
    if (!mount) {
        return;
    }

    const root = createRoot(mount);

    try {
        const code = compilePageTsx(source);
        const component = evaluatePageModule(code, pageModules) as React.ComponentType;
        root.render(<PageBoundary source={source}>{React.createElement(component)}</PageBoundary>);
    } catch (error) {
        root.render(<PageFailure error={errorMessage(error)} source={source} />);
    }
}

window.tavernPageRuntime = { render };

// biome-ignore lint/style/useReactFunctionComponents: React error boundaries require class components here.
class PageBoundary extends React.Component<
    { children: React.ReactNode; source: string },
    { error: string | null }
> {
    state: { error: string | null } = { error: null };

    static getDerivedStateFromError(error: unknown) {
        return { error: errorMessage(error) };
    }

    render() {
        if (this.state.error !== null) {
            return <PageFailure error={this.state.error} source={this.props.source} />;
        }
        return this.props.children;
    }
}

function PageFailure({ error, source }: { error: string; source: string }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
            <div
                style={{
                    background: 'var(--error-bg)',
                    border: '1px solid var(--error-border)',
                    borderRadius: 8,
                    color: 'var(--error-foreground)',
                    fontSize: 13,
                    lineHeight: 1.5,
                    padding: '10px 12px',
                }}
            >
                <strong>This page failed to render.</strong>
                <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{error}</div>
            </div>
            <pre
                style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    color: 'var(--muted-foreground)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    lineHeight: 1.6,
                    margin: 0,
                    overflow: 'auto',
                    padding: 12,
                }}
            >
                {source}
            </pre>
        </div>
    );
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
