import { describe, expect, test } from 'bun:test';
import type { AgentRuntimeConnectionStatus } from '../../hooks/connections/use-agent-runtime-connection.ts';
import { shouldRedirectToRuntimeOnboarding } from './tavern-runtime-gate.tsx';

describe('Tavern Runtime gate', () => {
    test('keeps configured but unreachable runtimes on the dashboard', () => {
        expect(shouldRedirectToRuntimeOnboarding('unreachable')).toBe(false);
    });

    test('shows onboarding for setup and version contract states', () => {
        const statuses: AgentRuntimeConnectionStatus[] = [
            'error',
            'unconfigured',
            'version-mismatch',
        ];

        for (const status of statuses) {
            expect(shouldRedirectToRuntimeOnboarding(status)).toBe(true);
        }
    });
});
