import { describe, expect, test } from 'vitest';
import {
    type MemoryExtractionMessage,
    memoryExtractionChunkChars,
    parseMemoryExtractionText,
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

describe('Memory extraction signals', () => {
    test('parses observations and a signals tail', () => {
        const parsed = parseMemoryExtractionText(
            [
                '- [1] User prefers concise status.',
                '- [2] Use the release checklist.',
                'SIGNALS',
                '- correction: Keep status short.',
                '- frustration: User pushed back on long explanations.',
                '- technique: Run focused runtime tests first.',
                '- skill_misfire[release-flow]: Missed the release checklist step.',
            ].join('\n')
        );

        expect(parsed.observations).toBe(
            '- [1] User prefers concise status.\n- [2] Use the release checklist.'
        );
        expect(parsed.signals).toEqual([
            { detail: 'Keep status short.', kind: 'correction' },
            {
                detail: 'User pushed back on long explanations.',
                kind: 'frustration',
            },
            { detail: 'Run focused runtime tests first.', kind: 'technique' },
            {
                detail: 'Missed the release checklist step.',
                kind: 'skill_misfire',
                skillId: 'release-flow',
            },
        ]);
    });

    test('returns no signals without a signals section', () => {
        expect(parseMemoryExtractionText('- [1] Durable fact.')).toEqual({
            observations: '- [1] Durable fact.',
            signals: [],
        });
    });

    test('drops unknown signal kinds and accepts case-insensitive headers', () => {
        expect(
            parseMemoryExtractionText(
                [
                    '- [1] Durable fact.',
                    'signals',
                    '- unknown: Ignore me.',
                    '- TECHNIQUE: Keep me.',
                ].join('\n')
            )
        ).toEqual({
            observations: '- [1] Durable fact.',
            signals: [{ detail: 'Keep me.', kind: 'technique' }],
        });
    });

    test('handles NONE plus signals', () => {
        expect(
            parseMemoryExtractionText(
                ['NONE', 'SIGNALS', '- correction: Prefer patches over prose.'].join('\n')
            )
        ).toEqual({
            observations: '',
            signals: [{ detail: 'Prefer patches over prose.', kind: 'correction' }],
        });
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
