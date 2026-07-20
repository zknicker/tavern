import { describe, expect, test } from 'bun:test';
import { resolveWikiAttachmentPath, wikiAttachmentRequestUrl } from './wiki-attachments.ts';

describe('Wiki attachments', () => {
    test('resolves a page-relative attachment path', () => {
        expect(
            resolveWikiAttachmentPath('projects/alpha/plan.md', './_attachments/launch chart.png')
        ).toBe('projects/alpha/_attachments/launch chart.png');
    });

    test('does not treat external or ordinary Wiki links as attachments', () => {
        expect(
            resolveWikiAttachmentPath('projects/plan.md', 'https://example.com/x.png')
        ).toBeNull();
        expect(resolveWikiAttachmentPath('projects/plan.md', '../other.png')).toBeNull();
    });

    test('builds the attachment proxy URL', () => {
        expect(wikiAttachmentRequestUrl('projects/plan.md', './_attachments/chart one.png')).toBe(
            '/wiki/attachments/projects/_attachments/chart%20one.png'
        );
    });

    test('canonicalizes an escaped attachment filename without double encoding', () => {
        expect(wikiAttachmentRequestUrl('projects/plan.md', './_attachments/chart%20one.png')).toBe(
            '/wiki/attachments/projects/_attachments/chart%20one.png'
        );
    });

    test('keeps unresolved image requests off the network', () => {
        expect(
            wikiAttachmentRequestUrl('projects/plan.md', 'https://example.com/x.png')
        ).toBeNull();
    });
});
