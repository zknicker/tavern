import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { readOpenClawPackageVersion, resolveManagedOpenClawVersion } from './version';

describe('resolveManagedOpenClawVersion', () => {
    it('reads the pinned root OpenClaw dev dependency', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tavern-openclaw-version-'));
        fs.mkdirSync(path.join(root, 'apps', 'runtime'), { recursive: true });
        fs.writeFileSync(
            path.join(root, 'package.json'),
            JSON.stringify({
                devDependencies: {
                    openclaw: '2026.5.12',
                },
                workspaces: ['apps/*'],
            })
        );

        expect(resolveManagedOpenClawVersion(path.join(root, 'apps', 'runtime'))).toBe('2026.5.12');
    });
});

describe('readOpenClawPackageVersion', () => {
    it('reads an installed OpenClaw package version', () => {
        const packageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tavern-openclaw-package-'));
        fs.writeFileSync(
            path.join(packageRoot, 'package.json'),
            JSON.stringify({
                version: '2026.5.7',
            })
        );

        expect(readOpenClawPackageVersion(packageRoot)).toBe('2026.5.7');
    });
});
