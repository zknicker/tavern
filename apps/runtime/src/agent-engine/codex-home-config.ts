import fs from 'node:fs/promises';
import path from 'node:path';

const managedMarker = '# tavern-managed: image generation routes through image_generate';

/**
 * Codex ships a built-in image_gen tool plus a bundled imagegen skill that
 * save outputs under CODEX_HOME, invisible to workspace browsing. Tavern owns
 * this CODEX_HOME, so both are switched off and image work flows through the
 * Runtime image_generate tool instead.
 */
export async function ensureCodexHomeConfig(codexHome: string) {
    const configPath = path.join(codexHome, 'config.toml');
    const existing = await readConfig(configPath);
    if (existing?.includes(managedMarker)) {
        return;
    }

    const skillPath = path.join(codexHome, 'skills', '.system', 'imagegen', 'SKILL.md');
    const managedBlock = [
        managedMarker,
        '[features]',
        'image_generation = false',
        '',
        '[[skills.config]]',
        `path = ${JSON.stringify(skillPath)}`,
        'enabled = false',
        '',
    ].join('\n');

    const content = existing ? `${existing.trimEnd()}\n\n${managedBlock}` : managedBlock;
    await fs.mkdir(codexHome, { recursive: true });
    await fs.writeFile(configPath, content, 'utf8');
}

async function readConfig(configPath: string) {
    try {
        return await fs.readFile(configPath, 'utf8');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return null;
        }
        throw error;
    }
}
