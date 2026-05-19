import { describe, expect, it } from 'bun:test';
import entry from '../index.js';

describe('Tavern Workspace OpenClaw plugin', () => {
    it('registers as a standalone OpenClaw plugin', () => {
        expect(entry.id).toBe('tavern-workspace');
        expect(entry.name).toBe('Tavern Workspace');
        expect(typeof entry.register).toBe('function');
    });
});
