import { describe, expect, test } from 'bun:test';
import { createAgentRuntimeClientForConnection } from './drivers.ts';

describe('clerk-session runtime clients', () => {
    test('fails construction when there is no active user session', () => {
        expect(() =>
            createAgentRuntimeClientForConnection(
                {
                    authJson: JSON.stringify({ kind: 'clerk-session' }),
                    baseUrl: 'http://runtime.test',
                },
                () => null
            )
        ).toThrow('No active user session');
    });
});
