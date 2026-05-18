import {
    agentRuntimeInstallSkillSchema,
    agentRuntimeSkillConfigCheckSchema,
    agentRuntimeSkillFileSchema,
    agentRuntimeSkillInstallOptionSchema,
    agentRuntimeSkillRequirementsSchema,
} from '@tavern/api';
import { z } from 'zod';

export const skillIdSchema = z.string().trim().min(1).max(200);

export const getSkillInputSchema = z.object({
    skillId: skillIdSchema,
});

export const deleteSkillInputSchema = z.object({
    skillId: skillIdSchema,
});

export const skillSecretEnvNameSchema = z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[A-Z_][A-Z0-9_]*$/u, 'Use a shell environment variable name.');

export const saveSkillSecretInputSchema = z.object({
    envName: skillSecretEnvNameSchema,
    skillId: skillIdSchema,
    value: z.string().min(1),
});

export const deleteSkillSecretInputSchema = z.object({
    envName: skillSecretEnvNameSchema,
    skillId: skillIdSchema,
});

export const checkSkillUpdatesInputSchema = z.object({
    skillId: skillIdSchema,
});

export const installSkillInputSchema = agentRuntimeInstallSkillSchema;

export const skillInstallSourceSchema = z.object({
    ref: z.string().min(1).nullable().optional(),
    source: z.enum(['clawhub', 'github']),
    spec: z.string().min(1),
    version: z.string().min(1).nullable().optional(),
});

export const skillDependencyStateSchema = z.enum(['missing', 'ready', 'unknown']);

export const skillAssignedAgentSchema = z.object({
    agentId: z.string().min(1),
    agentAvatar: z.string().min(1),
    agentName: z.string().min(1),
    agentPrimaryColor: z.string().min(1),
    baseDir: z.string().min(1).nullable(),
    commandVisible: z.boolean().nullable(),
    configChecks: z.array(agentRuntimeSkillConfigCheckSchema),
    dependencyState: skillDependencyStateSchema,
    eligible: z.boolean().nullable(),
    materializedName: z.string().min(1),
    missing: agentRuntimeSkillRequirementsSchema,
    modelVisible: z.boolean().nullable(),
    requirements: agentRuntimeSkillRequirementsSchema,
    runtimeId: z.string().min(1),
    syncError: z.string().nullable(),
});

export const skillSetupCommandSchema = z.object({
    bins: z.array(z.string().min(1)),
    command: z.string().min(1),
    id: z.string().min(1),
    label: z.string().min(1),
});

export const skillSecretSchema = z.object({
    configured: z.boolean(),
    envName: skillSecretEnvNameSchema,
    updatedAt: z.string().datetime().nullable(),
});

export const skillSummarySchema = z.object({
    agentCount: z.number().int().nonnegative(),
    allowedTools: z.string().nullable(),
    description: z.string().nullable(),
    id: z.string().min(1),
    installSource: skillInstallSourceSchema.nullable(),
    latestVersion: z.string().min(1).nullable(),
    name: z.string().min(1),
    dependencyState: skillDependencyStateSchema,
    missing: agentRuntimeSkillRequirementsSchema,
    updateAvailable: z.boolean(),
    updateCheckedAt: z.string().datetime().nullable(),
    updateError: z.string().nullable(),
    updatedAt: z.string().datetime().nullable(),
    version: z.string().min(1).nullable(),
});

export const skillDetailSchema = skillSummarySchema.extend({
    assignedAgents: z.array(skillAssignedAgentSchema),
    bodyMarkdown: z.string(),
    contentMarkdown: z.string(),
    files: z.array(agentRuntimeSkillFileSchema),
    install: z.array(agentRuntimeSkillInstallOptionSchema),
    license: z.string().nullable(),
    metadata: z.record(z.string(), z.unknown()).nullable(),
    requirements: agentRuntimeSkillRequirementsSchema,
    secrets: z.array(skillSecretSchema),
    setupCommands: z.array(skillSetupCommandSchema),
});

export const skillListSchema = z.object({
    skills: z.array(skillSummarySchema),
});

export const skillGetSchema = z.object({
    skill: skillDetailSchema.nullable(),
});

export const checkSkillUpdatesResultSchema = z.object({
    skill: skillDetailSchema,
});

export type SkillList = z.infer<typeof skillListSchema>;
export type SkillDetail = z.infer<typeof skillDetailSchema>;
