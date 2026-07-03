import { describe, expect, test } from 'vitest';
import {
    type MemoryExtractionMessage,
    memoryExtractionChunkChars,
    renderExtractionTranscript,
} from './extraction-worker.ts';

describe('Memory extraction transcript', () => {
    test('renders messages verbatim with multi-line content preserved', () => {
        const transcript = renderExtractionTranscript([
            message(1, 'user', 'Line one.\nLine two with  spacing.'),
            message(2, 'assistant', '```ts\nconst x = 1;\n```'),
        ]);

        expect(transcript).toBe(
            [
                '[1] user (usr_tavern, 2026-07-02T20:00:00.000Z):',
                'Line one.',
                'Line two with  spacing.',
                '',
                '[2] assistant (usr_tavern, 2026-07-02T20:00:00.000Z):',
                '```ts',
                'const x = 1;',
                '```',
            ].join('\n')
        );
    });

    test('truncates only a single message larger than the chunk budget, with a marker', () => {
        const oversized = 'y'.repeat(memoryExtractionChunkChars + 500);
        const transcript = renderExtractionTranscript([message(1, 'user', oversized)]);

        expect(transcript).toContain('[message truncated: 500 characters omitted]');
        expect(transcript.length).toBeLessThan(oversized.length + 200);

        const small = renderExtractionTranscript([message(1, 'user', 'Keep me whole.')]);
        expect(small).not.toContain('truncated');
    });
});

function message(
    sequence: number,
    role: 'assistant' | 'user',
    content: string
): MemoryExtractionMessage {
    return {
        author_id: 'usr_tavern',
        content,
        created_at: '2026-07-02T20:00:00.000Z',
        id: `msg_${sequence}`,
        role,
        sequence,
    };
}
