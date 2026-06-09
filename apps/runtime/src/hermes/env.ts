import fs from 'node:fs/promises';
import path from 'node:path';
import { HERMES_HOME } from '../config';

export async function readManagedHermesEnvValue(key: string): Promise<string | null> {
    const entries = readEnvEntries(
        await fs.readFile(path.join(HERMES_HOME, '.env'), 'utf8').catch(() => '')
    );
    return entries.get(key)?.trim() || null;
}

export function readEnvEntries(raw: string) {
    const entries = new Map<string, string>();
    for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!(trimmed && !trimmed.startsWith('#'))) {
            continue;
        }
        const separator = trimmed.indexOf('=');
        if (separator <= 0) {
            continue;
        }
        entries.set(trimmed.slice(0, separator), unquoteEnvValue(trimmed.slice(separator + 1)));
    }
    return entries;
}

export function quoteEnvValue(value: string) {
    return JSON.stringify(value);
}

function unquoteEnvValue(value: string) {
    const trimmed = value.trim();
    if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}
