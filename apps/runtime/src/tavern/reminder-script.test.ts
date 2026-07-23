import { describe, expect, it } from 'vitest';
import { boundScriptText } from './reminder-script.ts';

describe('boundScriptText', () => {
    it('keeps truncated multibyte output within the byte cap', () => {
        const output = boundScriptText('€'.repeat(6000));

        expect(output.endsWith('\n[truncated]')).toBe(true);
        expect(Buffer.byteLength(output)).toBeLessThanOrEqual(16_384);
        expect(output).not.toContain('�');
    });
});
