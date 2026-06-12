import { agentRuntimeSkillHubTapSchema, agentRuntimeSkillRequirementsSchema } from '@tavern/api';
import { z } from 'zod';

export const skillIdSchema = z.string().trim().min(1).max(200);

export const skillHubSearchInputSchema = z.object({
    query: z.string().trim().min(1).max(200),
    source: z.string().trim().min(1).max(50).optional(),
});

export const skillHubIdentifierInputSchema = z.object({
    identifier: z.string().trim().min(1).max(400),
});

export const skillHubInstallInputSchema = skillHubIdentifierInputSchema;

export const skillHubUninstallInputSchema = z.object({
    name: z.string().trim().min(1).max(200),
});

export const skillHubTapInputSchema = agentRuntimeSkillHubTapSchema;

export const skillHubTapRemoveInputSchema = z.object({
    repo: z.string().trim().min(1).max(200),
});

export const setSkillEnabledInputSchema = z.object({
    enabled: z.boolean(),
    skillId: skillIdSchema,
});

export const setToolsetEnabledInputSchema = z.object({
    enabled: z.boolean(),
    toolsetId: skillIdSchema,
});

export const skillDependencyStateSchema = z.enum(['missing', 'ready', 'unknown']);
export const skillPluginUsabilitySchema = z.enum(['disabled', 'enabled', 'not_usable']);
export const skillRuntimeSurfaceSchema = z.literal('hermes');

export const skillSummarySchema = z.object({
    allowedTools: z.string().nullable(),
    description: z.string().nullable(),
    id: z.string().min(1),
    name: z.string().min(1),
    diagnostic: z.string().nullable(),
    dependencyState: skillDependencyStateSchema,
    enabled: z.boolean(),
    missing: agentRuntimeSkillRequirementsSchema,
    surface: skillRuntimeSurfaceSchema,
    updatedAt: z.string().datetime().nullable(),
    usability: skillPluginUsabilitySchema,
    version: z.string().min(1).nullable(),
});

export const toolsetSummarySchema = z.object({
    configured: z.boolean(),
    description: z.string().nullable(),
    diagnostic: z.string().nullable(),
    enabled: z.boolean(),
    id: z.string().min(1),
    name: z.string().min(1),
    tools: z.array(z.string().min(1)),
    usability: skillPluginUsabilitySchema,
});

export const skillListSchema = z.object({
    skills: z.array(skillSummarySchema),
    toolsets: z.array(toolsetSummarySchema),
});

export type SkillList = z.infer<typeof skillListSchema>;
export type SkillSummary = z.infer<typeof skillSummarySchema>;
export type ToolsetSummary = z.infer<typeof toolsetSummarySchema>;
