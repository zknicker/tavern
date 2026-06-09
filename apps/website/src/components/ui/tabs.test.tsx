import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Tabs, TabsList, TabsTrigger } from './tabs.tsx';

describe('Tabs', () => {
    test('keeps default tab items content-sized', () => {
        const markup = renderToStaticMarkup(
            <Tabs value="preview">
                <TabsList>
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                    <TabsTrigger value="code">Code</TabsTrigger>
                </TabsList>
            </Tabs>
        );

        expect(markup).toContain('w-fit');
        expect(markup).not.toContain(' grow ');
    });

    test('allows callers to opt into stretched tab items', () => {
        const markup = renderToStaticMarkup(
            <Tabs value="preview">
                <TabsList>
                    <TabsTrigger className="grow" value="preview">
                        Preview
                    </TabsTrigger>
                    <TabsTrigger className="grow" value="code">
                        Code
                    </TabsTrigger>
                </TabsList>
            </Tabs>
        );

        expect(markup).toContain(' grow');
    });
});
