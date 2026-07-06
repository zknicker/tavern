import { describe, expect, test } from 'bun:test';
import { renderToString } from 'react-dom/server';
import { SecretInput } from './secret-input.tsx';

describe('SecretInput', () => {
    test('enables reveal for saved secret values', () => {
        const markup = renderToString(
            <SecretInput
                ariaLabel="MerchBase API key"
                disabled={false}
                name="merchbase-api-key"
                onChange={() => undefined}
                onRevealToggle={() => undefined}
                revealed={false}
                value="secret-key"
            />
        );

        expect(markup).toContain('Reveal MerchBase API key');
        expect(markup).not.toContain('disabled=""');
    });

    test('keeps reveal disabled when no secret value is present', () => {
        const markup = renderToString(
            <SecretInput
                ariaLabel="MerchBase API key"
                disabled={false}
                name="merchbase-api-key"
                onChange={() => undefined}
                onRevealToggle={() => undefined}
                revealed={false}
                value=""
            />
        );

        expect(markup).toContain('Reveal MerchBase API key');
        expect(markup).toContain('disabled=""');
    });
});
