import { describe, expect, test } from 'bun:test';
import type { RuntimeConnectionStatus } from '../../hooks/connections/use-runtime-connection.ts';
import { shouldRedirectToRuntimeOnboarding } from './dashboard-setup-gate.tsx';

describe('dashboard setup gate', () => {
    test('keeps runtime startup and reconnect states on the dashboard', () => {
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

    test('keeps configured version contract states on the dashboard', () => {
        expect(
            shouldRedirectToRuntimeOnboarding({
                hasConfiguredRuntime: true,
                status: 'version-mismatch',
            })
        ).toBe(false);
    });
});
