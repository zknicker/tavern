import { describe, expect, it } from 'bun:test';
import { clerkNativeOptions } from './clerk-native-options.ts';

describe('clerkNativeOptions', () => {
    it('loads Clerk in native mode for the Electron app', () => {
        expect(clerkNativeOptions).toEqual({ standardBrowser: false });
    });
});
