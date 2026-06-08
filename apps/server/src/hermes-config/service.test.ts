import { expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const directory = mkdtempSync(join(tmpdir(), 'tavern-hermes-config-service-'));
process.env.DATABASE_PATH = join(directory, 'test.sqlite');

const { shouldApplyHermesConfigFixups } = await import('./service.ts');

test('shouldApplyHermesConfigFixups skips invalid runtime config snapshots', () => {
    expect(shouldApplyHermesConfigFixups({ valid: false })).toBe(false);
    expect(shouldApplyHermesConfigFixups({ valid: true })).toBe(true);
    expect(shouldApplyHermesConfigFixups({ valid: null })).toBe(true);
});
