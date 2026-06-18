import { describe, expect, test } from 'bun:test';
import { EyeIcon, LayoutTwoColumnIcon } from '@hugeicons-pro/core-stroke-rounded';
import { renderToStaticMarkup } from 'react-dom/server';
import { TabItem, Tabs, TabsList } from './tabs.tsx';

describe('Tabs', () => {
    test('renders the Fluid Base UI tab item API', () => {
        const markup = renderToStaticMarkup(
            <Tabs value="preview">
                <TabsList>
                    <TabItem icon={EyeIcon} label="Preview" value="preview" />
                    <TabItem icon={LayoutTwoColumnIcon} label="Split" value="split" />
                </TabsList>
            </Tabs>
        );

        expect(markup).toContain('role="tablist"');
        expect(markup).toContain('data-proximity-index="0"');
        expect(markup).toContain('Preview');
        expect(markup).toContain('Split');
    });

    test('keeps icon-only tabs labeled without rendering text', () => {
        const markup = renderToStaticMarkup(
            <Tabs value="preview">
                <TabsList>
                    <TabItem icon={EyeIcon} iconOnly label="Preview" value="preview" />
                    <TabItem icon={LayoutTwoColumnIcon} iconOnly label="Split" value="split" />
                </TabsList>
            </Tabs>
        );

        expect(markup).toContain('aria-label="Preview"');
        expect(markup).toContain('title="Preview"');
        expect(markup).not.toContain('>Preview<');
        expect(markup).not.toContain('>Split<');
    });
});
