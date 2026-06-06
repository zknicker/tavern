import { getActiveCortexSchemaRecord } from './cortex-schema';
import type { CortexDatabase } from './db';
import { ensureCortexFilesystem } from './filesystem';
import { ensureCortexSchema } from './pglite-schema';
import { ensureDefaultCortexSettings } from './settings';

export async function ensureCortexRuntimeBootstrap(db: CortexDatabase): Promise<void> {
    await ensureCortexSchema(db);
    ensureCortexFilesystem();
    await getActiveCortexSchemaRecord(db);
    await ensureDefaultCortexSettings(db);
}
