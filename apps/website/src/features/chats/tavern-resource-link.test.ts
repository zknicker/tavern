import { expect, test } from 'bun:test';
import { formatTavernResourceLink, parseTavernResourceLink } from './tavern-resource-link.ts';

test('parseTavernResourceLink parses Wiki page links', () => {
    expect(parseTavernResourceLink('tavern://wiki/docs/adr/0005.md')).toEqual({
        kind: 'wikiPage',
        path: 'docs/adr/0005.md',
    });
    expect(parseTavernResourceLink('tavern://wiki/Demos/Artifact%20Panel%20Brief.md')).toEqual({
        kind: 'wikiPage',
        path: 'Demos/Artifact Panel Brief.md',
    });
});

test('parseTavernResourceLink parses workspace file links', () => {
    expect(parseTavernResourceLink('tavern://workspace/out/preview.html')).toEqual({
        kind: 'workspaceFile',
        path: 'out/preview.html',
    });
});

test('parseTavernResourceLink rejects unsafe or unsupported links', () => {
    expect(parseTavernResourceLink('https://example.com')).toBeNull();
    expect(parseTavernResourceLink('tavern://settings/agents')).toBeNull();
    expect(parseTavernResourceLink('tavern://wiki/../secret.md')).toBeNull();
    expect(parseTavernResourceLink('tavern://wiki//secret.md')).toBeNull();
    expect(parseTavernResourceLink('tavern://wiki/docs/page.md?mode=raw')).toBeNull();
});

test('formatTavernResourceLink formats clickable artifact links', () => {
    const href = formatTavernResourceLink({
        kind: 'wikiPage',
        path: 'Demos/Artifact Panel Brief.md',
    });

    expect(href).toBe('tavern://wiki/Demos/Artifact%20Panel%20Brief.md');
    expect(parseTavernResourceLink(href)).toEqual({
        kind: 'wikiPage',
        path: 'Demos/Artifact Panel Brief.md',
    });
});
