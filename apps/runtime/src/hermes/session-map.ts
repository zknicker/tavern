import fs from 'node:fs/promises';
import path from 'node:path';
import { HERMES_HOME } from '../config';

export interface HermesSessionMapping {
    hermesSessionKey: string;
    tavernSessionKey: string;
    updatedAt: string;
}

interface HermesSessionMapDocument {
    mappings?: Record<string, HermesSessionMapping>;
}

const defaultSessionMapPath = path.join(HERMES_HOME, 'tavern-session-map.json');

export async function getHermesSessionMapping(
    tavernSessionKey: string,
    filePath = defaultSessionMapPath
) {
    const document = await readSessionMap(filePath);
    return document.mappings[tavernSessionKey] ?? null;
}

export async function saveHermesSessionMapping(
    mapping: Omit<HermesSessionMapping, 'updatedAt'>,
    filePath = defaultSessionMapPath
) {
    const document = await readSessionMap(filePath);
    document.mappings[mapping.tavernSessionKey] = {
        ...mapping,
        updatedAt: new Date().toISOString(),
    };
    await writeSessionMap(filePath, document);
}

export async function deleteHermesSessionMapping(
    tavernSessionKey: string,
    filePath = defaultSessionMapPath
) {
    const document = await readSessionMap(filePath);
    if (!(tavernSessionKey in document.mappings)) {
        return;
    }
    delete document.mappings[tavernSessionKey];
    await writeSessionMap(filePath, document);
}

async function readSessionMap(
    filePath: string
): Promise<{ mappings: Record<string, HermesSessionMapping> }> {
    try {
        const parsed = JSON.parse(await fs.readFile(filePath, 'utf8')) as HermesSessionMapDocument;
        return {
            mappings: parsed.mappings && typeof parsed.mappings === 'object' ? parsed.mappings : {},
        };
    } catch {
        return { mappings: {} };
    }
}

async function writeSessionMap(
    filePath: string,
    document: { mappings: Record<string, HermesSessionMapping> }
) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(document, null, 2)}\n`, { mode: 0o600 });
    await fs.chmod(filePath, 0o600).catch(() => undefined);
}
