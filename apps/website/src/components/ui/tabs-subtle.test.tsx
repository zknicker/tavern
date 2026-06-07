import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { TabsSubtle, TabsSubtleItem, TabsSubtleList } from './tabs-subtle.tsx';

describe('TabsSubtle', () => {
    test('keeps every enabled tab in the sequential tab order', () => {
        const markup = renderToStaticMarkup(
            <TabsSubtle value="one">
                <TabsSubtleList>
                    <TabsSubtleItem label="One" value="one" />
                    <TabsSubtleItem label="Two" value="two" />
                    <TabsSubtleItem disabled label="Three" value="three" />
                </TabsSubtleList>
            </TabsSubtle>
        );

        expect(markup).toContain('focus-visible:inset-ring-2');
        expect(markup.match(/tabindex="0"/g)).toHaveLength(2);
        expect(markup).toContain('aria-disabled="true"');
    });
});
