import fs from 'node:fs';
import path from 'node:path';

export function nowIso() {
    return new Date().toISOString();
}

export function readJsonObject(value: string | null | undefined): Record<string, unknown> {
    if (!value) {
        return {};
    }

    try {
        const parsed = JSON.parse(value) as unknown;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : {};
    } catch {
        return {};
    }
}

export function readJsonStringArray(value: string | null | undefined): string[] {
    if (!value) {
        return [];
    }

    try {
        const parsed = JSON.parse(value) as unknown;
        return Array.isArray(parsed)
            ? parsed.filter(
                  (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0
              )
            : [];
    } catch {
        return [];
    }
}

export function encodeJson(value: unknown) {
    return JSON.stringify(value);
}

export function toAgentRuntimeKind(
    value: null | string | undefined
): 'claude' | 'codex' | 'opencode' {
    if (value === 'codex' || value === 'opencode') {
        return value;
    }

    return 'claude';
}

export function ensureDirectory(pathname: string) {
    fs.mkdirSync(pathname, { recursive: true });
}

export function readTextFile(pathname: string): null | string {
    try {
        return fs.readFileSync(pathname, 'utf8');
    } catch {
        return null;
    }
}

export function writeTextFile(pathname: string, content: string) {
    ensureDirectory(path.dirname(pathname));
    fs.writeFileSync(pathname, content);
}
