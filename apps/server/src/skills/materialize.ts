import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentRuntimeSkillSummary } from '@tavern/agent-runtime-protocol';
import type { TavernAgentRuntimeClient } from '../agent-runtime/client.ts';
import { listAgentRuntimeSkills } from '../agent-runtime/skills.ts';
import type { AgentProjection } from '../storage/agents.ts';
import { assertLocalOpenClawWorkspace } from './local-openclaw.ts';
import { copyDirectory } from './package-files.ts';
import {
    listAgentSkillSelections,
    type SkillPackageRecord,
    saveAgentSkillSyncState,
} from './storage.ts';

const rootMarkerFileName = '.tavern-managed.json';
const skillMarkerFileName = '.tavern-skill.json';

export async function syncAgentWorkspaceSkills(input: {
    agent: AgentProjection;
    packages: SkillPackageRecord[];
    runtimeClient: TavernAgentRuntimeClient;
}) {
    const workspace = await assertLocalOpenClawWorkspace(input.agent);
    const skillsDir = path.join(workspace, 'skills');
    const selections = await listAgentSkillSelections(input.agent.id);
    const packagesById = new Map(input.packages.map((item) => [item.id, item]));
    const desired = selections.flatMap((selection) => {
        const pkg = packagesById.get(selection.skillPackageId);
        return pkg ? [{ package: pkg, selection }] : [];
    });

    await fs.mkdir(skillsDir, { recursive: true });
    await writeRootMarker(skillsDir, input.agent);
    await purgeUnexpectedSkills(
        skillsDir,
        new Set(desired.map((item) => item.selection.materializedName))
    );

    for (const item of desired) {
        await materializeSkill({
            agent: input.agent,
            package: item.package,
            selectionName: item.selection.materializedName,
            skillsDir,
        });
    }

    const observedSkills = await listAgentRuntimeSkills(
        input.runtimeClient,
        input.agent.runtimeId,
        {
            agentId: input.agent.id,
        }
    );
    await verifyMaterializedSkills({
        agent: input.agent,
        desired,
        observedSkills: observedSkills ?? [],
        skillsDir,
    });
}

async function materializeSkill(input: {
    agent: AgentProjection;
    package: SkillPackageRecord;
    selectionName: string;
    skillsDir: string;
}) {
    const targetDir = path.join(input.skillsDir, input.selectionName);
    const tempDir = path.join(input.skillsDir, `.tavern-tmp-${randomUUID()}`);

    await fs.rm(tempDir, { force: true, recursive: true });
    await copyDirectory(input.package.cachePath, tempDir);
    await writeSkillMarker(tempDir, input);
    await fs.rm(targetDir, { force: true, recursive: true });
    await fs.rename(tempDir, targetDir);
}

async function verifyMaterializedSkills(input: {
    agent: AgentProjection;
    desired: Array<{
        package: SkillPackageRecord;
        selection: Awaited<ReturnType<typeof listAgentSkillSelections>>[number];
    }>;
    observedSkills: AgentRuntimeSkillSummary[];
    skillsDir: string;
}) {
    for (const item of input.desired) {
        const expectedBaseDir = path.resolve(input.skillsDir, item.selection.materializedName);
        const observed = input.observedSkills.find((skill) =>
            skill.baseDir ? path.resolve(skill.baseDir) === expectedBaseDir : false
        );
        const syncError = validateObservedSkill({ expectedBaseDir, observed });

        await saveAgentSkillSyncState({
            agentId: input.agent.id,
            observedJson: observed ? JSON.stringify(observed) : null,
            skillPackageId: item.package.id,
            syncError,
        });
    }
}

function validateObservedSkill(input: {
    expectedBaseDir: string;
    observed: AgentRuntimeSkillSummary | undefined;
}) {
    if (!input.observed) {
        return `OpenClaw did not report the workspace skill at ${input.expectedBaseDir}.`;
    }
    if (input.observed.runtimeSource !== 'openclaw-workspace') {
        return `OpenClaw reported source "${input.observed.runtimeSource ?? 'unknown'}" instead of openclaw-workspace.`;
    }
    if (input.observed.eligible === false) {
        return (
            formatMissingRequirements(input.observed) ?? 'OpenClaw marked this skill ineligible.'
        );
    }
    return null;
}

function formatMissingRequirements(skill: AgentRuntimeSkillSummary) {
    const missing = skill.missing;
    const groups = [
        ['bins', missing.bins],
        ['anyBins', missing.anyBins],
        ['env', missing.env],
        ['config', missing.config],
        ['os', missing.os],
    ] as const;
    const parts = groups.flatMap(([label, values]) =>
        values.length > 0 ? [`${label}: ${values.join(', ')}`] : []
    );
    return parts.length > 0 ? `Missing requirements (${parts.join('; ')}).` : null;
}

async function purgeUnexpectedSkills(skillsDir: string, desiredNames: Set<string>) {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    await Promise.all(
        entries.map(async (entry) => {
            if (entry.name === rootMarkerFileName || desiredNames.has(entry.name)) {
                return;
            }
            await fs.rm(path.join(skillsDir, entry.name), { force: true, recursive: true });
        })
    );
}

async function writeRootMarker(skillsDir: string, agent: AgentProjection) {
    await fs.writeFile(
        path.join(skillsDir, rootMarkerFileName),
        `${JSON.stringify(
            {
                agentId: agent.id,
                managedBy: 'tavern',
                ownership: 'exclusive',
                runtimeId: agent.runtimeId,
                schemaVersion: 1,
                updatedAt: new Date().toISOString(),
            },
            null,
            2
        )}\n`
    );
}

async function writeSkillMarker(
    skillDir: string,
    input: {
        agent: AgentProjection;
        package: SkillPackageRecord;
        selectionName: string;
    }
) {
    await fs.writeFile(
        path.join(skillDir, skillMarkerFileName),
        `${JSON.stringify(
            {
                agentId: input.agent.id,
                contentHash: input.package.contentHash,
                managedBy: 'tavern',
                materializedAt: new Date().toISOString(),
                materializedName: input.selectionName,
                packageId: input.package.id,
                runtimeId: input.agent.runtimeId,
                schemaVersion: 1,
                sourceSpec: input.package.sourceSpec,
                sourceType: input.package.sourceType,
                sourceVersion: input.package.resolvedVersion,
            },
            null,
            2
        )}\n`
    );
}
