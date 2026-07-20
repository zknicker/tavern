import { expect, test } from 'bun:test';
import { wikiAttachmentCacheControl } from './service.ts';

test('Wiki attachments are not cached across external file mutations', () => {
    expect(wikiAttachmentCacheControl()).toBe('no-store');
});
