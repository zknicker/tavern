import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const testFiles = [...walk(join(root, 'test')), ...walk(join(root, 'src'))]
    .filter((file) => file.endsWith('.test.ts'))
    .sort();

for (const file of testFiles) {
    const display = relative(root, file);
    const result = spawnSync('bun', ['test', display], {
        cwd: root,
        env: process.env,
        stdio: 'inherit',
    });

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

function* walk(directory) {
    let entries;

    try {
        entries = readdirSync(directory);
    } catch {
        return;
    }

    for (const entry of entries) {
        const path = join(directory, entry);
        const stat = statSync(path);

        if (stat.isDirectory()) {
            yield* walk(path);
            continue;
        }

        yield path;
    }
}
