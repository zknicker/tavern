import fs from 'node:fs/promises';
import path from 'node:path';
import {
    type AgentRuntimeSkillHubTap,
    type AgentRuntimeSkillHubTapList,
    agentRuntimeSkillHubTapSchema,
} from '@tavern/api';
import { HERMES_HOME } from '../config';

/**
 * Hub taps are custom GitHub repo skill sources. The engine reads them from
 * `<home>/skills/.hub/taps.json`; it has no HTTP surface for managing them, so
 * Runtime owns the file directly — the same managed-config pattern as the
 * bundled-skill allowlist.
 */

export interface SkillTapsOptions {
    home?: string;
}

export async function listSkillHubTaps(
    options?: SkillTapsOptions
): Promise<AgentRuntimeSkillHubTapList> {
    return { taps: await readTaps(options) };
}

export async function addSkillHubTap(
    input: unknown,
    options?: SkillTapsOptions
): Promise<AgentRuntimeSkillHubTapList> {
    const tap = agentRuntimeSkillHubTapSchema.parse(input);
    const taps = await readTaps(options);
    if (taps.some((existing) => existing.repo === tap.repo)) {
        throw new Error(`Skill source "${tap.repo}" is already configured.`);
    }
    const next = [...taps, tap];
    await writeTaps(next, options);
    return { taps: next };
}

export async function removeSkillHubTap(
    repo: string,
    options?: SkillTapsOptions
): Promise<AgentRuntimeSkillHubTapList> {
    const taps = await readTaps(options);
    const next = taps.filter((tap) => tap.repo !== repo);
    if (next.length === taps.length) {
        throw new Error(`Skill source "${repo}" is not configured.`);
    }
    await writeTaps(next, options);
    return { taps: next };
}

function tapsFilePath(options?: SkillTapsOptions) {
    return path.join(options?.home ?? HERMES_HOME, 'skills', '.hub', 'taps.json');
}

async function readTaps(options?: SkillTapsOptions): Promise<AgentRuntimeSkillHubTap[]> {
    const raw = await fs.readFile(tapsFilePath(options), 'utf8').catch(() => null);
    if (raw === null) {
        return [];
    }
    const parsed: unknown = JSON.parse(raw);
    const taps =
        typeof parsed === 'object' &&
        parsed !== null &&
        Array.isArray((parsed as { taps?: unknown }).taps)
            ? ((parsed as { taps: unknown[] }).taps ?? [])
            : [];
    return taps.flatMap((tap) => {
        const result = agentRuntimeSkillHubTapSchema.safeParse(tap);
        return result.success ? [result.data] : [];
    });
}

async function writeTaps(taps: AgentRuntimeSkillHubTap[], options?: SkillTapsOptions) {
    const filePath = tapsFilePath(options);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify({ taps }, null, 2)}\n`, 'utf8');
}
