import type { SQLQueryBindings } from 'bun:sqlite';
import { Database } from 'bun:sqlite';

export { Database };

export type SqlBindingValue = string | bigint | NodeJS.TypedArray | number | boolean | null;

export type SqlNamedBindings = Record<string, SqlBindingValue>;

function toSqlBindingValue(value: unknown): SqlBindingValue {
    if (value === null) {
        return null;
    }
    if (
        typeof value === 'string' ||
        typeof value === 'bigint' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
    ) {
        return value;
    }
    if (ArrayBuffer.isView(value)) {
        return value as NodeJS.TypedArray;
    }
    throw new TypeError(`Unsupported SQLite binding value: ${typeof value}`);
}

export function namedParams<T extends object>(params: T): SqlNamedBindings {
    const bindings: SqlNamedBindings = {};

    for (const [key, rawValue] of Object.entries(params)) {
        const value = toSqlBindingValue(rawValue);
        bindings[key] = value;
        bindings[`@${key}`] = value;
        bindings[`$${key}`] = value;
        bindings[`:${key}`] = value;
    }

    return bindings;
}

export function positionalParams(values: unknown[]): SQLQueryBindings[] {
    return values.map((value) => toSqlBindingValue(value));
}

export function optionalRow<T>(value: T | null): T | undefined {
    return value ?? undefined;
}

export function hasRow(value: unknown): boolean {
    return value !== null && value !== undefined;
}

export function setPragma(db: Database, pragma: string, value: number | string): void {
    db.exec(`PRAGMA ${pragma} = ${typeof value === 'number' ? value : value}`);
}
