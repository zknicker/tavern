import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { vector } from '@electric-sql/pglite/vector';

import { RUNTIME_ROOT, readConfigValue } from '../config';
import { log } from '../log';

const require = createRequire(import.meta.url);

export type CortexSqlParam = boolean | number | string | null;
export type CortexNamedParams = Record<string, CortexSqlParam | undefined>;
export type CortexParams = CortexNamedParams | CortexSqlParam[];

export interface CortexPreparedStatement {
    all<T = Record<string, unknown>>(...params: CortexStatementParams): Promise<T[]>;
    get<T = Record<string, unknown>>(...params: CortexStatementParams): Promise<T | null>;
    run(...params: CortexStatementParams): Promise<void>;
}

export interface CortexDatabase {
    close(): Promise<void>;
    exec(sql: string): Promise<void>;
    prepare(sql: string): CortexPreparedStatement;
    query<T = Record<string, unknown>>(sql: string, params?: CortexParams): Promise<T[]>;
    transaction<T>(callback: (db: CortexDatabase) => Promise<T>): Promise<T>;
}

type CortexStatementParams = [] | [CortexNamedParams] | CortexSqlParam[];
interface PgliteQueryable {
    close?: () => Promise<void>;
    exec(sql: string): Promise<unknown>;
    query<T = Record<string, unknown>>(
        sql: string,
        params?: CortexSqlParam[]
    ): Promise<{
        rows: T[];
    }>;
    transaction?<T>(callback: (tx: PgliteQueryable) => Promise<T>): Promise<T>;
}

let _cortexDb: CortexDatabase | null = null;

export const defaultCortexDatabasePath = path.join(RUNTIME_ROOT, 'cortex', 'cortex.pglite');

export function resolveCortexDatabasePath(): string {
    const configuredPath = readConfigValue('TAVERN_CORTEX_DATABASE_PATH');
    return configuredPath ? resolveConfiguredPath(configuredPath) : defaultCortexDatabasePath;
}

function resolveConfiguredPath(configuredPath: string): string {
    const homeDirectory = process.env.HOME;
    if (configuredPath === '~') {
        return homeDirectory || configuredPath;
    }
    if (homeDirectory && configuredPath.startsWith('~/')) {
        return path.join(homeDirectory, configuredPath.slice(2));
    }
    return path.resolve(configuredPath);
}

export async function initCortexDb(
    databasePath = resolveCortexDatabasePath()
): Promise<CortexDatabase> {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    const pglite = await PGlite.create({
        dataDir: databasePath,
        extensions: createCortexPgliteExtensions(),
        ...(await createCortexPgliteRuntimeOptions()),
    });
    _cortexDb = new PgliteCortexDatabase(pglite);
    log.info('Cortex DB initialized', { engine: 'pglite', path: databasePath });
    return _cortexDb;
}

export function getCortexDb(): CortexDatabase {
    if (!_cortexDb) {
        throw new Error('Cortex database not initialized. Call initCortexDb() first.');
    }
    return _cortexDb;
}

export async function closeCortexDb(): Promise<void> {
    await _cortexDb?.close();
    _cortexDb = null;
}

export async function initTestCortexDb(): Promise<CortexDatabase> {
    const pglite = await PGlite.create({
        extensions: createCortexPgliteExtensions(),
        ...(await createCortexPgliteRuntimeOptions()),
    });
    _cortexDb = new PgliteCortexDatabase(pglite);
    return _cortexDb;
}

async function createCortexPgliteRuntimeOptions(): Promise<{
    fsBundle: Blob;
    initdbWasmModule: WebAssembly.Module;
    pgliteWasmModule: WebAssembly.Module;
}> {
    const assetDirectory = resolvePgliteAssetDirectory();
    return {
        fsBundle: new Blob([fs.readFileSync(path.join(assetDirectory, 'pglite.data'))]),
        initdbWasmModule: await WebAssembly.compile(
            fs.readFileSync(path.join(assetDirectory, 'initdb.wasm'))
        ),
        pgliteWasmModule: await WebAssembly.compile(
            fs.readFileSync(path.join(assetDirectory, 'pglite.wasm'))
        ),
    };
}

function createCortexPgliteExtensions() {
    return {
        pg_trgm: {
            ...pg_trgm,
            setup: async (...args: Parameters<typeof pg_trgm.setup>) => ({
                ...(await pg_trgm.setup(...args)),
                bundlePath: pathToFileURL(
                    path.join(resolvePgliteAssetDirectory(), 'pg_trgm.tar.gz')
                ),
            }),
        },
        vector: {
            ...vector,
            setup: async (...args: Parameters<typeof vector.setup>) => ({
                ...(await vector.setup(...args)),
                bundlePath: pathToFileURL(
                    path.join(resolvePgliteAssetDirectory(), 'vector.tar.gz')
                ),
            }),
        },
    };
}

function resolvePgliteAssetDirectory(): string {
    const candidates = [
        path.dirname(fileURLToPath(import.meta.url)),
        process.argv[1] ? path.dirname(path.resolve(process.argv[1])) : null,
        path.dirname(process.execPath),
    ];

    for (const candidate of candidates) {
        if (candidate && fs.existsSync(path.join(candidate, 'pglite.data'))) {
            return candidate;
        }
    }

    return path.dirname(require.resolve('@electric-sql/pglite'));
}

class PgliteCortexDatabase implements CortexDatabase {
    constructor(private readonly pglite: PgliteQueryable) {}

    async close(): Promise<void> {
        await this.pglite.close?.();
    }

    async exec(sql: string): Promise<void> {
        await this.pglite.exec(sql);
    }

    prepare(sql: string): CortexPreparedStatement {
        return {
            all: async <T = Record<string, unknown>>(...params: CortexStatementParams) =>
                await this.query<T>(sql, normalizeStatementParams(params)),
            get: async <T = Record<string, unknown>>(...params: CortexStatementParams) =>
                (await this.query<T>(sql, normalizeStatementParams(params))).at(0) ?? null,
            run: async (...params: CortexStatementParams) => {
                await this.query(sql, normalizeStatementParams(params));
            },
        };
    }

    async query<T = Record<string, unknown>>(sql: string, params?: CortexParams): Promise<T[]> {
        const prepared = preparePostgresQuery(sql, params);
        const result = await this.pglite.query<T>(prepared.sql, prepared.params);
        return result.rows;
    }

    async transaction<T>(callback: (db: CortexDatabase) => Promise<T>): Promise<T> {
        if (!this.pglite.transaction) {
            return await callback(this);
        }
        return await this.pglite.transaction(
            async (tx) => await callback(new PgliteCortexDatabase(tx))
        );
    }
}

function normalizeStatementParams(params: CortexStatementParams): CortexParams | undefined {
    if (params.length === 0) {
        return undefined;
    }
    if (params.length === 1 && isNamedParams(params[0])) {
        return params[0];
    }
    return params as CortexSqlParam[];
}

function preparePostgresQuery(
    sql: string,
    params: CortexParams | undefined
): { params?: CortexSqlParam[]; sql: string } {
    if (!params) {
        return { sql };
    }
    if (Array.isArray(params)) {
        let index = 0;
        return {
            params,
            sql: sql.replace(/\?/gu, () => `$${++index}`),
        };
    }

    const ordered: CortexSqlParam[] = [];
    const indexes = new Map<string, number>();
    const rewritten = sql.replace(/[$@:](?<name>[A-Za-z_][A-Za-z0-9_]*)/gu, (match, name) => {
        if (!(name in params)) {
            return match;
        }
        let index = indexes.get(name);
        if (!index) {
            ordered.push(params[name] ?? null);
            index = ordered.length;
            indexes.set(name, index);
        }
        return `$${index}`;
    });

    return { params: ordered, sql: rewritten };
}

function isNamedParams(value: unknown): value is CortexNamedParams {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
