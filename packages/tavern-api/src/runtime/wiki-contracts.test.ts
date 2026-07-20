import { expect, test } from 'bun:test';
import { wikiAttachmentMaxBase64Length, wikiUploadAttachmentSchema } from './contracts.ts';

const attachmentInput = {
    filename: 'chart.png',
    mediaType: 'image/png' as const,
    pagePath: 'Projects/Alpha.md',
};

test('bounds Wiki attachment base64 before Runtime storage', () => {
    expect(
        wikiUploadAttachmentSchema.safeParse({
            ...attachmentInput,
            contentBase64: 'a'.repeat(wikiAttachmentMaxBase64Length),
        }).success
    ).toBe(true);
    expect(
        wikiUploadAttachmentSchema.safeParse({
            ...attachmentInput,
            contentBase64: 'a'.repeat(wikiAttachmentMaxBase64Length + 1),
        }).success
    ).toBe(false);
});
