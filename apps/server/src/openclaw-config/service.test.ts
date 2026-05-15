import { expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const directory = mkdtempSync(join(tmpdir(), 'tavern-openclaw-config-service-'));
process.env.DATABASE_PATH = join(directory, 'test.sqlite');

const { shouldApplyOpenClawConfigFixups } = await import('./service.ts');

test('shouldApplyOpenClawConfigFixups skips invalid runtime config snapshots', () => {
    expect(shouldApplyOpenClawConfigFixups({ valid: false })).toBe(false);
    expect(shouldApplyOpenClawConfigFixups({ valid: true })).toBe(true);
    expect(shouldApplyOpenClawConfigFixups({ valid: null })).toBe(true);
});
