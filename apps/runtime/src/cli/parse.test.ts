import { describe, expect, test } from 'vitest';
import { levenshtein, parseArgs, suggest, UsageError } from './parse';
import type { CliCommand } from './registry';

function command(overrides: Partial<CliCommand> = {}): CliCommand {
    return {
        name: 'demo',
        section: 'Status',
        summary: 'demo',
        usage: 'tavern demo',
        flags: [
            { name: '--json', description: 'json' },
            { name: '--topic', valueName: '<topic>', description: 'topic' },
        ],
        examples: [],
        run: () => Promise.resolve(0),
        ...overrides,
    };
}

describe('parseArgs', () => {
    test('separates boolean flags, valued flags, and positionals', () => {
        const parsed = parseArgs(command(), ['get', '--json', '--topic', 'runtime', 'overview']);
        expect(parsed.flags).toEqual({ '--json': true });
        expect(parsed.values).toEqual({ '--topic': 'runtime' });
        expect(parsed.positionals).toEqual(['get', 'overview']);
        expect(parsed.help).toBe(false);
    });

    test('--help short-circuits', () => {
        expect(parseArgs(command(), ['--help']).help).toBe(true);
        expect(parseArgs(command(), ['-h']).help).toBe(true);
    });

    test('unknown flag raises UsageError carrying the command', () => {
        try {
            parseArgs(command(), ['--nope']);
            throw new Error('expected throw');
        } catch (error) {
            expect(error).toBeInstanceOf(UsageError);
            expect((error as UsageError).command?.name).toBe('demo');
            expect((error as UsageError).message).toContain("Unknown flag '--nope'");
        }
    });

    test('valued flag missing its value raises UsageError', () => {
        expect(() => parseArgs(command(), ['--topic'])).toThrow(UsageError);
        expect(() => parseArgs(command(), ['--topic', '--json'])).toThrow(/requires a value/);
    });
});

describe('suggest', () => {
    test('levenshtein distance', () => {
        expect(levenshtein('updte', 'update')).toBe(1);
        expect(levenshtein('enginee', 'engine')).toBe(1);
        expect(levenshtein('zzz', 'update')).toBeGreaterThan(2);
    });

    test('returns nearest within distance 2', () => {
        expect(suggest('updte', ['update', 'restart', 'engine'])).toBe('update');
        expect(suggest('enginee', ['update', 'engine'])).toBe('engine');
    });

    test('returns null when nothing is within distance 2', () => {
        expect(suggest('zzzzz', ['update', 'engine'])).toBeNull();
    });
});
