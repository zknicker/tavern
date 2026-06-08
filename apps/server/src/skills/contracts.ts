import {
    agentRuntimeSkillFileSchema,
    agentRuntimeSkillInstallOptionSchema,
    agentRuntimeSkillRequirementsSchema,
} from '@tavern/api';
import { z } from 'zod';

export const skillIdSchema = z.string().trim().min(1).max(200);

export const getSkillInputSchema = z.object({
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

export const skillDependencyStateSchema = z.enum(['missing', 'ready', 'unknown']);
export const skillPluginUsabilitySchema = z.enum(['disabled', 'enabled', 'not_usable']);
export const skillRuntimeSurfaceSchema = z.enum(['codex', 'hermes']);

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
    allowedTools: z.string().nullable(),
    description: z.string().nullable(),
    id: z.string().min(1),
    name: z.string().min(1),
    diagnostic: z.string().nullable(),
    dependencyState: skillDependencyStateSchema,
    missing: agentRuntimeSkillRequirementsSchema,
    surface: skillRuntimeSurfaceSchema,
    updatedAt: z.string().datetime().nullable(),
    usability: skillPluginUsabilitySchema,
    version: z.string().min(1).nullable(),
});

export const pluginSummarySchema = z.object({
    description: z.string().nullable(),
    diagnostic: z.string().nullable(),
    enabled: z.boolean(),
    id: z.string().min(1),
    name: z.string().min(1),
    source: z.string().min(1),
    updatedAt: z.string().datetime().nullable(),
    usability: skillPluginUsabilitySchema,
});

export const skillDetailSchema = skillSummarySchema.extend({
    bodyMarkdown: z.string(),
    contentMarkdown: z.string(),
    files: z.array(agentRuntimeSkillFileSchema),
    install: z.array(agentRuntimeSkillInstallOptionSchema),
    installSource: z.unknown().nullable(),
    license: z.string().nullable(),
    metadata: z.record(z.string(), z.unknown()).nullable(),
    requirements: agentRuntimeSkillRequirementsSchema,
    secrets: z.array(skillSecretSchema),
    setupCommands: z.array(skillSetupCommandSchema),
});

export const skillListSchema = z.object({
    plugins: z.array(pluginSummarySchema),
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
export type PluginSummary = z.infer<typeof pluginSummarySchema>;
