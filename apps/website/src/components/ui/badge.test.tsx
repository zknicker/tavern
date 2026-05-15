import { describe, expect, test } from 'bun:test';
import { Badge, CustomBadge } from './badge.tsx';

describe('badge exports', () => {
    test('keeps CustomBadge as an alias of Badge', () => {
        expect(CustomBadge).toBe(Badge);
    });
});
