import { expect, test } from 'bun:test';
import { buildStartedChatDisplayName } from './chat-start-title.ts';

test('buildStartedChatDisplayName normalizes whitespace', () => {
    expect(buildStartedChatDisplayName(' What   skills\ncan you use? ')).toBe(
        'What skills can you use?'
    );
});

test('buildStartedChatDisplayName truncates long prompts', () => {
    expect(buildStartedChatDisplayName('a'.repeat(80))).toBe(`${'a'.repeat(67)}...`);
});
