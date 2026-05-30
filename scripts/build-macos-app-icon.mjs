import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(currentDirectory, '..');
const sourceIconPath = path.join(repositoryRoot, 'assets', 'mac-icon.icon');
const iconsDirectory = path.join(repositoryRoot, 'apps', 'website', 'src-tauri', 'icons');
const generatedIconsDirectory = path.join(
    repositoryRoot,
    'apps',
    'website',
    'src-tauri',
    'generated-icons'
);

const stagedIconPath = path.join(
    mkdtempSync(path.join(tmpdir(), 'tavern-app-icon-')),
    'AppIcon.icon'
);
const outputDirectory = mkdtempSync(path.join(tmpdir(), 'tavern-app-icon-out-'));

if (!existsSync(sourceIconPath)) {
    throw new Error(`Missing Icon Composer source: ${sourceIconPath}`);
}

try {
    const actoolPath = execFileSync('/usr/bin/xcrun', ['-f', 'actool'], {
        encoding: 'utf8',
    }).trim();

    mkdirSync(generatedIconsDirectory, { recursive: true });
    cpSync(sourceIconPath, stagedIconPath, { recursive: true });
    execFileSync(
        actoolPath,
        [
            stagedIconPath,
            '--app-icon',
            'AppIcon',
            '--compile',
            outputDirectory,
            '--output-partial-info-plist',
            path.join(outputDirectory, 'assetcatalog_generated_info.plist'),
            '--minimum-deployment-target',
            '11.0',
            '--platform',
            'macosx',
            '--target-device',
            'mac',
        ],
        { stdio: 'pipe' }
    );

    cpSync(
        path.join(outputDirectory, 'Assets.car'),
        path.join(generatedIconsDirectory, 'Assets.car')
    );
    cpSync(path.join(outputDirectory, 'AppIcon.icns'), path.join(iconsDirectory, 'AppIcon.icns'));
    cpSync(path.join(outputDirectory, 'AppIcon.icns'), path.join(iconsDirectory, 'icon.icns'));

    console.log('[tavern] macOS app icon compiled from assets/mac-icon.icon');
} finally {
    rmSync(path.dirname(stagedIconPath), { recursive: true, force: true });
    rmSync(outputDirectory, { recursive: true, force: true });
}
