import { expect, test } from 'bun:test';
import {
    formatChatPaneTargetLink,
    mergeChatPaneOpenTarget,
    parseChatPaneTargetLink,
} from './pane-links.ts';

test('parseChatPaneTargetLink parses Wiki page links', () => {
    expect(parseChatPaneTargetLink('grotto://wiki/docs/adr/0005.md')).toEqual({
        kind: 'wikiPage',
        path: 'docs/adr/0005.md',
    });
    expect(parseChatPaneTargetLink('grotto://wiki/Demos/Artifact%20Panel%20Brief.md')).toEqual({
        kind: 'wikiPage',
        path: 'Demos/Artifact Panel Brief.md',
    });
});

test('parseChatPaneTargetLink parses workspace file links', () => {
    expect(parseChatPaneTargetLink('grotto://workspace/out/preview.html')).toEqual({
        kind: 'workspaceFile',
        path: 'out/preview.html',
    });
});

test('parseChatPaneTargetLink parses empty paths as directory targets', () => {
    expect(parseChatPaneTargetLink('grotto://wiki/')).toEqual({
        kind: 'wikiDirectory',
        path: '',
    });
    expect(parseChatPaneTargetLink('grotto://workspace/')).toEqual({
        kind: 'workspaceDirectory',
        path: '',
    });
});

test('parseChatPaneTargetLink rejects unsafe or unsupported links', () => {
    expect(parseChatPaneTargetLink('https://example.com')).toBeNull();
    expect(parseChatPaneTargetLink('grotto://settings/agents')).toBeNull();
    expect(parseChatPaneTargetLink('grotto://wiki/../secret.md')).toBeNull();
    expect(parseChatPaneTargetLink('grotto://wiki//secret.md')).toBeNull();
    expect(parseChatPaneTargetLink('grotto://wiki/docs/page.md?mode=raw')).toBeNull();
});

test('parseChatPaneTargetLink resolves encoded dot segments inside the root', () => {
    // URL normalization consumes %2e%2e against the root before parsing, so
    // encoded traversal can never surface a `..` segment in the parsed path.
    expect(parseChatPaneTargetLink('grotto://workspace/%2e%2e/secret.md')).toEqual({
        kind: 'workspaceFile',
        path: 'secret.md',
    });
});

const wikiPage = { kind: 'wikiPage', path: 'Demos/Brief.md' } as const;
const reportFile = { kind: 'workspaceFile', path: 'workbench/report.md' } as const;
const notesFile = { kind: 'workspaceFile', path: 'NOTES.md' } as const;
const workspaceRoot = { kind: 'workspaceRoot', path: '' } as const;

test('mergeChatPaneOpenTarget appends and focuses new non-workspace targets', () => {
    expect(mergeChatPaneOpenTarget([reportFile], wikiPage)).toEqual({
        activeKey: 'wikiPage:Demos/Brief.md',
        targets: [reportFile, wikiPage],
    });
});

test('mergeChatPaneOpenTarget focuses an existing target without duplicating it', () => {
    expect(mergeChatPaneOpenTarget([wikiPage, reportFile], reportFile)).toEqual({
        activeKey: 'workspaceFile:workbench/report.md',
        targets: [wikiPage, reportFile],
    });
});

test('mergeChatPaneOpenTarget replaces the one workspace tab on a new file open', () => {
    expect(mergeChatPaneOpenTarget([wikiPage, reportFile], notesFile)).toEqual({
        activeKey: 'workspaceFile:NOTES.md',
        targets: [wikiPage, notesFile],
    });
});

test('mergeChatPaneOpenTarget keeps the open file on a directory or root open', () => {
    expect(mergeChatPaneOpenTarget([reportFile], workspaceRoot)).toEqual({
        activeKey: 'workspaceFile:workbench/report.md',
        targets: [reportFile],
    });
});

test('mergeChatPaneOpenTarget appends a workspace tab when none exists', () => {
    expect(mergeChatPaneOpenTarget([wikiPage], workspaceRoot)).toEqual({
        activeKey: 'workspaceRoot:',
        targets: [wikiPage, workspaceRoot],
    });
});

test('formatChatPaneTargetLink formats clickable artifact links', () => {
    const href = formatChatPaneTargetLink({
        kind: 'wikiPage',
        path: 'Demos/Artifact Panel Brief.md',
    });

    expect(href).toBe('grotto://wiki/Demos/Artifact%20Panel%20Brief.md');
    expect(parseChatPaneTargetLink(href)).toEqual({
        kind: 'wikiPage',
        path: 'Demos/Artifact Panel Brief.md',
    });
});

test('parseChatPaneTargetLink rejects Tavern links', () => {
    expect(parseChatPaneTargetLink('tavern://wiki/INDEX.md')).toBeNull();
});
