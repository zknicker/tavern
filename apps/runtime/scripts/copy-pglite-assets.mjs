import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const runtimeRoot = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const outputDir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(runtimeRoot, 'dist');
const pgliteDist = path.dirname(require.resolve('@electric-sql/pglite'));

const assetNames = ['initdb.wasm', 'pg_trgm.tar.gz', 'pglite.data', 'pglite.wasm', 'vector.tar.gz'];

mkdirSync(outputDir, { recursive: true });

for (const assetName of assetNames) {
    copyFileSync(path.join(pgliteDist, assetName), path.join(outputDir, assetName));
}
