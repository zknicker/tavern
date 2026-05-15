import os from 'node:os';
import { join } from 'node:path';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    schema: './src/db/schema.ts',
    out: './drizzle',
    dialect: 'sqlite',
    dbCredentials: {
        url: process.env.DATABASE_PATH ?? join(os.homedir(), '.tavern', 'tavern.sqlite'),
    },
    strict: true,
    verbose: true,
});
