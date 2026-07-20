import { expect, mock, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

const persistedPage = {
    body: '# Panel Brief\n\nPersisted content.',
    frontmatter: {},
    hash: 'a'.repeat(64),
    links: [],
    path: 'Demos/Panel Brief.md',
    size: 39,
    title: 'Panel Brief',
    updatedAt: '2026-07-20T14:00:00.000Z',
    wikiPath: '/tmp/wiki',
};
let pageData: typeof persistedPage | null = persistedPage;
let editorState = createEditorState();

mock.module('../../hooks/pane/use-pane-editor-host.ts', () => ({
    usePaneEditorHost: () => editorState,
}));

mock.module('../../hooks/wiki/use-wiki-pane-editor-adapter.ts', () => ({
    useWikiPaneEditorAdapter: () => ({
        imagePreview: async (source: string) => source,
        isWriting: false,
        uploadImage: async () => './_attachments/image.png',
    }),
}));

mock.module('../../hooks/wiki/use-wiki-mutations.ts', () => ({
    useCreateWikiPage: () => ({
        isPending: false,
        mutateAsync: async () => ({ page: persistedPage }),
    }),
}));

mock.module('../../hooks/wiki/use-wiki-page.ts', () => ({
    useWikiPage: () => ({
        data: pageData,
        error: null,
        isFetching: false,
        isPending: false,
    }),
}));

const { ChatArtifactWikiPage } = await import('./chat-artifact-wiki-page.tsx');

test('the shared Wiki artifact page exposes editing', () => {
    pageData = persistedPage;
    editorState = createEditorState();
    const markup = renderToStaticMarkup(<ChatArtifactWikiPage path="Demos/Panel Brief.md" />);

    expect(markup).toContain('>Edit<');
});

test('View previews the current draft', () => {
    pageData = persistedPage;
    editorState = createEditorState('# Panel Brief\n\nUnsaved draft.');

    const markup = renderToStaticMarkup(<ChatArtifactWikiPage path={persistedPage.path} />);

    expect(markup).toContain('Unsaved draft.');
    expect(markup).not.toContain('Persisted content.');
});

test('a removed page keeps its dirty draft visible', () => {
    pageData = null;
    editorState = {
        ...createEditorState('# Panel Brief\n\nPreserved draft.'),
        externalChange: 'missing' as const,
    };

    const markup = renderToStaticMarkup(<ChatArtifactWikiPage path={persistedPage.path} />);

    expect(markup).toContain('This page was removed. Your draft is preserved.');
    expect(markup).toContain('Preserved draft.');
    expect(markup).toContain('>Discard<');
    expect(markup).toContain('>Recreate<');
});

function createEditorState(draft = persistedPage.body) {
    return {
        canSave: draft !== persistedPage.body,
        draft,
        externalChange: null as 'changed' | 'missing' | null,
        keepDraft: () => undefined,
        lastSnapshot: {
            content: persistedPage.body,
            document: persistedPage,
            revision: persistedPage.hash,
        },
        reload: () => undefined,
        replaceSnapshot: () => undefined,
        save: async () => undefined,
        saveError: null,
        setDraft: () => undefined,
    };
}
