import fs from 'node:fs';
import { log } from '../log';
import { resolveCortexWikiPath } from './read';

export function ensureCortexFilesystem(): void {
    const wikiPath = resolveCortexWikiPath();
    try {
        fs.mkdirSync(wikiPath, { recursive: true });
    } catch (error) {
        log.warn('Cortex wiki directory could not be created', { error, wikiPath });
    }
}
