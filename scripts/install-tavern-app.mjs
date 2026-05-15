import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'darwin') {
    console.error('Tavern desktop release install is only supported on macOS.');
    process.exit(1);
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');
const sourceAppPath = join(
    repositoryRoot,
    'apps',
    'website',
    'src-tauri',
    'target',
    'release',
    'bundle',
    'macos',
    'Tavern.app'
);
const destinationAppPath = '/Applications/Tavern.app';

if (!existsSync(sourceAppPath)) {
    console.error(`Built app not found at ${sourceAppPath}.`);
    process.exit(1);
}

rmSync(destinationAppPath, { force: true, recursive: true });
cpSync(sourceAppPath, destinationAppPath, { recursive: true });

console.log(`Installed Tavern.app to ${destinationAppPath}`);
