import { describe, expect, test } from 'bun:test';
import type { ComponentType } from 'react';
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import * as kit from '../../kit/index.ts';
import {
    buildPageModules,
    compilePageTsx,
    evaluatePageModule,
    PageRenderError,
    pageSourceMaxBytes,
} from './compile.ts';

/**
 * The real compile-and-render path: the same sucrase compile, import
 * resolution, and evaluation the iframe runtime performs, rendered against
 * the actual kit exports.
 */

const modules = buildPageModules({
    jsxRuntime: jsxRuntime as unknown as Record<string, unknown>,
    kit: kit as unknown as Record<string, unknown>,
    react: React as unknown as Record<string, unknown>,
});

function renderPage(source: string): string {
    const component = evaluatePageModule(compilePageTsx(source), modules) as ComponentType;
    return renderToStaticMarkup(React.createElement(component));
}

describe('page compile pipeline', () => {
    test('compiles and renders a valid page composing the kit', () => {
        const markup = renderPage(`
            import { useState } from 'react';
            import { Card, Table } from '@tavern/kit';

            function Legend({ label }: { label: string }) {
                return <p>{label}</p>;
            }

            export default function Page() {
                const [count] = useState(3);
                return (
                    <Card size="full" title="Fleet status">
                        <Legend label={'Ships: ' + count} />
                        <Table
                            columns={[{ key: 'ship', label: 'Ship' }]}
                            rows={[{ ship: 'Erebos' }]}
                        />
                    </Card>
                );
            }
        `);

        expect(markup).toContain('Fleet status');
        expect(markup).toContain('Ships: 3');
        expect(markup).toContain('Erebos');
    });

    test('renders default-imported React pages too', () => {
        const markup = renderPage(`
            import React from 'react';

            export default function Page() {
                return React.createElement('p', null, 'plain react');
            }
        `);

        expect(markup).toContain('plain react');
    });

    test('rejects any import outside react and the kit, URLs above all', () => {
        for (const specifier of [
            'https://esm.sh/lodash',
            'react-dom/client',
            '@tavern/kit/internals',
            'node:fs',
        ]) {
            const code = compilePageTsx(
                `import thing from '${specifier}';\nexport default function Page() { return <p>{String(thing)}</p>; }`
            );
            expect(() => evaluatePageModule(code, modules)).toThrow(PageRenderError);
            expect(() => evaluatePageModule(code, modules)).toThrow(specifier);
        }
    });

    test('rejects disallowed imports even when the binding is unused', () => {
        const code = compilePageTsx(
            "import axios from 'https://esm.sh/axios';\nexport default function Page() { return <p>hi</p>; }"
        );

        expect(() => evaluatePageModule(code, modules)).toThrow('https://esm.sh/axios');
    });

    test('reports syntax errors as compile failures', () => {
        expect(() => compilePageTsx('export default function Page( { return <p>; }')).toThrow(
            PageRenderError
        );
        expect(() => compilePageTsx('const = ;')).toThrow(/TSX compile failed/u);
    });

    test('rejects oversize sources before compiling', () => {
        const oversize = `export default function Page() { return <p>big</p>; }\n// ${'x'.repeat(
            pageSourceMaxBytes
        )}`;

        expect(() => compilePageTsx(oversize)).toThrow(/too large/u);
    });

    test('requires a default-exported component', () => {
        const code = compilePageTsx('export const answer = 42;');

        expect(() => evaluatePageModule(code, modules)).toThrow(
            /must default-export a React component/u
        );
    });
});
