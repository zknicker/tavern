import { ensureDatabaseSchema } from './bootstrap.ts';

try {
    ensureDatabaseSchema();
} catch (error) {
    console.error('[tavern] schema setup failed', error);
    process.exitCode = 1;
}
