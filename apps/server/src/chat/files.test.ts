import { afterEach, expect, mock, spyOn, test } from 'bun:test';
import { listChatFiles } from './files.ts';
import type { RuntimeChatTimelinePage } from './runtime-chat-api.ts';
import * as runtimeChatApi from './runtime-chat-api.ts';

afterEach(() => {
    mock.restore();
});

test('listChatFiles walks every log page and returns attachment metadata newest first', async () => {
    const requestedCursors: Array<number | undefined> = [];
    spyOn(runtimeChatApi, 'getRuntimeChatTimelinePage').mockImplementation(
        async (_chatId, input) => {
            requestedCursors.push(input?.beforeSequence);

            return input?.beforeSequence === undefined
                ? page({
                      nextBeforeSequence: 12,
                      rows: [
                          messageRow({
                              attachments: [
                                  {
                                      dataBase64: 'must-not-leak',
                                      filename: 'latest.png',
                                      mediaType: 'image/png',
                                      sizeBytes: 2048,
                                      type: 'inline',
                                  },
                              ],
                              id: 'msg_latest',
                              sender: 'Ada',
                              timestamp: '2026-07-21T14:00:00.000Z',
                          }),
                      ],
                  })
                : page({
                      nextBeforeSequence: null,
                      rows: [
                          messageRow({
                              attachments: [
                                  {
                                      filename: 'notes.txt',
                                      path: '/runtime/notes.txt',
                                      type: 'file',
                                  },
                              ],
                              id: 'msg_older',
                              sender: 'Zach',
                              timestamp: '2026-07-20T12:00:00.000Z',
                          }),
                      ],
                  });
        }
    );

    const result = await listChatFiles('cht_1');

    expect(requestedCursors).toEqual([undefined, 12]);
    expect(result).toEqual({
        files: [
            {
                actor: { id: 'agt_ada', kind: 'agent' },
                at: '2026-07-21T14:00:00.000Z',
                filename: 'latest.png',
                id: 'msg_latest:0',
                kind: 'inline',
                mediaType: 'image/png',
                messageId: 'msg_latest',
                senderName: 'Ada',
                sizeBytes: 2048,
            },
            {
                actor: { id: 'agt_ada', kind: 'agent' },
                at: '2026-07-20T12:00:00.000Z',
                filename: 'notes.txt',
                id: 'msg_older:0',
                kind: 'file',
                mediaType: null,
                messageId: 'msg_older',
                senderName: 'Zach',
                sizeBytes: null,
            },
        ],
    });
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
    expect(JSON.stringify(result)).not.toContain('/runtime/notes.txt');
});

function page(input: {
    nextBeforeSequence: number | null;
    rows: RuntimeChatTimelinePage['rows'];
}): RuntimeChatTimelinePage {
    return {
        nextBeforeSequence: input.nextBeforeSequence,
        rows: input.rows,
        totalMessages: 2,
    };
}

function messageRow(input: {
    attachments: NonNullable<
        Extract<
            RuntimeChatTimelinePage['rows'][number],
            { kind: 'message' }
        >['message']['attachments']
    >;
    id: string;
    sender: string;
    timestamp: string;
}): Extract<RuntimeChatTimelinePage['rows'][number], { kind: 'message' }> {
    const actor = { id: 'agt_ada', kind: 'agent' as const };

    return {
        actor,
        connectsToNext: false,
        connectsToPrevious: false,
        id: input.id,
        isFirstInGroup: true,
        kind: 'message',
        message: {
            actor,
            attachments: input.attachments,
            content: '',
            id: input.id,
            sender: input.sender,
            senderType: 'agent',
            sourceSessionId: null,
            sourceSessionKey: 'session_1',
            tavernAgentId: 'agt_ada',
            timestamp: input.timestamp,
        },
    };
}
