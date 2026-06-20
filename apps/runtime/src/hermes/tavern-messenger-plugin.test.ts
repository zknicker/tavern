import { describe, expect, it } from 'vitest';
import { tavernMessengerPluginSource } from './tavern-messenger-plugin';

describe('tavern messenger plugin', () => {
    it('registers Tavern as a platform without render tools', () => {
        const source = tavernMessengerPluginSource();

        expect(source).toContain('ctx.register_platform(');
        expect(source).toContain('name="tavern"');
        expect(source).not.toContain('ctx.register_tool(');
    });
});
