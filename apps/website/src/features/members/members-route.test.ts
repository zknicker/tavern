import { expect, test } from 'bun:test';
import { isHumansMembersPath } from './members-route.ts';

test('the Humans member view accepts canonical and trailing-slash URLs', () => {
    expect(isHumansMembersPath('/members/humans')).toBe(true);
    expect(isHumansMembersPath('/members/humans/')).toBe(true);
    expect(isHumansMembersPath('/members')).toBe(false);
});
