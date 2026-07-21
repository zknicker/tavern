import { type ChatFileEntry, chatFileListSchema } from './files-contracts.ts';
import { getRuntimeChatTimelinePage } from './runtime-chat-api.ts';

const pageLimit = 100;

export async function listChatFiles(chatId: string) {
    const files: ChatFileEntry[] = [];
    let beforeSequence: number | undefined;

    do {
        const page = await getRuntimeChatTimelinePage(chatId, {
            beforeSequence,
            limit: pageLimit,
        });

        if (!page) {
            break;
        }

        for (const row of page.rows) {
            if (row.kind !== 'message') {
                continue;
            }

            for (const [index, attachment] of (row.message.attachments ?? []).entries()) {
                files.push({
                    actor: row.actor,
                    at: row.message.timestamp,
                    filename: attachment.filename,
                    id: `${row.message.id}:${index}`,
                    kind: attachment.type,
                    mediaType: attachment.mediaType ?? null,
                    messageId: row.message.id,
                    senderName: row.message.sender,
                    sizeBytes: attachment.sizeBytes ?? null,
                });
            }
        }

        beforeSequence = page.nextBeforeSequence ?? undefined;
    } while (beforeSequence !== undefined);

    files.sort((left, right) => right.at.localeCompare(left.at) || left.id.localeCompare(right.id));

    return chatFileListSchema.parse({ files });
}
