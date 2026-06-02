import { describe, expect, test } from 'bun:test';
import type { AgentRuntimeConnectionStatus } from '../../hooks/connections/use-agent-runtime-connection.ts';
import { shouldRedirectToRuntimeOnboarding } from './dashboard-setup-gate.tsx';

describe('dashboard setup gate', () => {
    test('keeps runtime startup and reconnect states on the dashboard', () => {
        const statuses: AgentRuntimeConnectionStatus[] = [
            'checking',
            'error',
            'reachable',
            'unreachable',
        ];

        for (const status of statuses) {
            expect(shouldRedirectToRuntimeOnboarding(status)).toBe(false);
        }
    });

    test('shows onboarding for setup and version contract states', () => {
        const statuses: AgentRuntimeConnectionStatus[] = ['unconfigured', 'version-mismatch'];

        for (const status of statuses) {
            expect(shouldRedirectToRuntimeOnboarding(status)).toBe(true);
        }
    });
});
