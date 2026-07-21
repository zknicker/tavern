import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MembersAdmin } from './members-admin.tsx';

test('Members settings keeps keyless development usable', () => {
    const markup = renderToStaticMarkup(<MembersAdmin />);

    expect(markup).toContain('Members');
    expect(markup).toContain('Members are available when Grotto sign-in is enabled.');
});
