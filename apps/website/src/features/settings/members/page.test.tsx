import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MembersSettings } from './page.tsx';

test('Members settings keeps keyless development usable', () => {
    const markup = renderToStaticMarkup(<MembersSettings />);

    expect(markup).toContain('Members');
    expect(markup).toContain('Members are available when Tavern sign-in is enabled.');
});
