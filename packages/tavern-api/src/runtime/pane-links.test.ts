import { expect, test } from 'bun:test';
import { formatChatPaneTargetLink, parseChatPaneTargetLink } from './pane-links.ts';

test('parseChatPaneTargetLink parses Wiki page links', () => {
    expect(parseChatPaneTargetLink('tavern://wiki/docs/adr/0005.md')).toEqual({
        kind: 'wikiPage',
        path: 'docs/adr/0005.md',
    });
    expect(parseChatPaneTargetLink('tavern://wiki/Demos/Artifact%20Panel%20Brief.md')).toEqual({
        kind: 'wikiPage',
        path: 'Demos/Artifact Panel Brief.md',
    });
});

test('parseChatPaneTargetLink parses workspace file links', () => {
    expect(parseChatPaneTargetLink('tavern://workspace/out/preview.html')).toEqual({
        kind: 'workspaceFile',
        path: 'out/preview.html',
    });
});

test('parseChatPaneTargetLink parses empty paths as directory targets', () => {
    expect(parseChatPaneTargetLink('tavern://wiki/')).toEqual({
        kind: 'wikiDirectory',
        path: '',
    });
    expect(parseChatPaneTargetLink('tavern://workspace/')).toEqual({
        kind: 'workspaceDirectory',
        path: '',
    });
});

test('parseChatPaneTargetLink rejects unsafe or unsupported links', () => {
    expect(parseChatPaneTargetLink('https://example.com')).toBeNull();
    expect(parseChatPaneTargetLink('tavern://settings/agents')).toBeNull();
    expect(parseChatPaneTargetLink('tavern://wiki/../secret.md')).toBeNull();
    expect(parseChatPaneTargetLink('tavern://wiki//secret.md')).toBeNull();
    expect(parseChatPaneTargetLink('tavern://wiki/docs/page.md?mode=raw')).toBeNull();
});

test('parseChatPaneTargetLink resolves encoded dot segments inside the root', () => {
    // URL normalization consumes %2e%2e against the root before parsing, so
    // encoded traversal can never surface a `..` segment in the parsed path.
    expect(parseChatPaneTargetLink('tavern://workspace/%2e%2e/secret.md')).toEqual({
        kind: 'workspaceFile',
        path: 'secret.md',
    });
});

test('formatChatPaneTargetLink formats clickable artifact links', () => {
    const href = formatChatPaneTargetLink({
        kind: 'wikiPage',
        path: 'Demos/Artifact Panel Brief.md',
    });

    expect(href).toBe('tavern://wiki/Demos/Artifact%20Panel%20Brief.md');
    expect(parseChatPaneTargetLink(href)).toEqual({
        kind: 'wikiPage',
        path: 'Demos/Artifact Panel Brief.md',
    });
});
