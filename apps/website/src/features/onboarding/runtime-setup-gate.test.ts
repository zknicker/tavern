import { describe, expect, test } from 'bun:test';
import type { RuntimeConnectionStatus } from '../../hooks/connections/use-runtime-connection.ts';
import { shouldRedirectToRuntimeOnboarding } from './runtime-setup-gate.tsx';

describe('runtime setup gate', () => {
    test('keeps runtime startup and reconnect states in the app', () => {
        const statuses: RuntimeConnectionStatus[] = [
            'checking',
            'error',
            'reachable',
            'unreachable',
        ];

        for (const status of statuses) {
            expect(
                shouldRedirectToRuntimeOnboarding({
                    hasConfiguredRuntime: true,
                    status,
                })
            ).toBe(false);
        }
    });

    test('shows onboarding only when Runtime has not been configured', () => {
        expect(
            shouldRedirectToRuntimeOnboarding({
                hasConfiguredRuntime: false,
                status: 'unconfigured',
            })
        ).toBe(true);

        expect(
            shouldRedirectToRuntimeOnboarding({
                hasConfiguredRuntime: true,
                status: 'unconfigured',
            })
        ).toBe(false);
    });

    test('keeps configured version contract states in the app', () => {
        expect(
            shouldRedirectToRuntimeOnboarding({
                hasConfiguredRuntime: true,
                status: 'version-mismatch',
            })
        ).toBe(false);
    });
});
