import { describe, expect, it } from 'bun:test';
import entry from '../index.js';

describe('Tavern Cortex plugin entry', () => {
    it('registers as a standalone OpenClaw plugin', () => {
        expect(entry.id).toBe('tavern-cortex');
        expect(typeof entry.register).toBe('function');
    });
});
