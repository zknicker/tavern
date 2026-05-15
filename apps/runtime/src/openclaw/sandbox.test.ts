import { describe, expect, it } from 'vitest';

import { buildOpenClawLaunchCommand } from './sandbox';

describe('buildOpenClawLaunchCommand', () => {
    it('requires a Seatbelt launch wrapper', async () => {
        const command = await buildOpenClawLaunchCommand('/tmp/openclaw', {
            installPath: '/tmp/install',
            stateDir: '/tmp/state',
            workspaceDir: '/tmp/workspace',
        });

        expect(command[0]).toBe('sandbox-exec');
        expect(command.at(-1)).toBe('/tmp/openclaw');
    });
});
