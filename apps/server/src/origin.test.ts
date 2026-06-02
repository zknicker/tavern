import { describe, expect, test } from 'bun:test';
import { isAllowedAppOrigin } from './origin.ts';

describe('isAllowedAppOrigin', () => {
    test('allows packaged Electron file origins', () => {
        expect(isAllowedAppOrigin('file://')).toBe(true);
        expect(isAllowedAppOrigin('file:///Applications/Tavern.app/index.html')).toBe(true);
    });
});
