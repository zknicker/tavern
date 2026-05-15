import {
    agentRuntimeModelProviderIdSchema,
    parseAgentRuntimeModelRef,
} from '@tavern/agent-runtime-protocol';
import { z } from 'zod';
import { openClawHarnessSchema } from './openclaw-mapping.ts';

export const modelAvailabilitySchema = z.enum(['configured', 'available']);
export const thinkingLevelSchema = z.enum([
    'off',
    'minimal',
    'low',
    'medium',
    'high',
    'xhigh',
    'adaptive',
    'max',
]);
export const modelRefSchema = z
    .string()
    .trim()
    .min(1)
    .refine(
        (value) => {
            try {
                parseAgentRuntimeModelRef(value);
                return true;
            } catch {
                return false;
            }
        },
        {
            message: 'Model ref must use "<provider>/<modelId>".',
        }
    );

export const modelSchema = z.object({
    availability: modelAvailabilitySchema,
    contextWindow: z.number().int().positive().nullable(),
    framework: z.string().min(1),
    id: z.string().min(1),
    modelId: z.string().min(1),
    name: z.string().min(1),
    openClawNames: z
        .array(
            z.object({
                available: z.boolean(),
                harness: openClawHarnessSchema,
                id: z.string().min(1),
                isPreferred: z.boolean(),
                label: z.string().min(1),
                model: z.string().min(1),
                provider: z.string().min(1),
            })
        )
        .optional(),
    provider: agentRuntimeModelProviderIdSchema,
    ref: modelRefSchema,
    reasoning: z.boolean().nullable(),
    supportsChatRouting: z.boolean(),
});

export const modelSelectionSchema = z.object({
    fallbackModels: z.array(modelRefSchema),
    primaryModel: modelRefSchema.nullable(),
});

export const agentModelSettingSchema = z.object({
    agentId: z.string().min(1),
    agentName: z.string().min(1),
    harness: openClawHarnessSchema.nullable(),
    modelId: modelRefSchema.nullable(),
    openClawModelNameId: z.string().min(1).nullable(),
    syncError: z.string().nullable(),
    syncedAt: z.string().nullable(),
    effective: modelSelectionSchema,
    effectiveThinkingDefault: thinkingLevelSchema.nullable(),
    isOverridden: z.boolean(),
    isThinkingOverridden: z.boolean(),
    override: modelSelectionSchema,
    overrideThinkingDefault: thinkingLevelSchema.nullable(),
    subAgentModel: modelRefSchema.nullable(),
});

export const openRouterSettingsSchema = z.object({
    hasApiKey: z.boolean(),
    updatedAt: z.string().nullable(),
});

export const modelListSchema = z.object({
    agents: z.array(agentModelSettingSchema),
    defaults: modelSelectionSchema,
    defaultsThinkingLevel: thinkingLevelSchema.nullable(),
    models: z.array(modelSchema),
    openRouter: openRouterSettingsSchema,
    subAgentDefaultModel: modelRefSchema.nullable(),
    subAgentThinkingLevel: thinkingLevelSchema.nullable(),
});

export type AgentModelSetting = z.infer<typeof agentModelSettingSchema>;
export type Model = z.infer<typeof modelSchema>;
export type ModelList = z.infer<typeof modelListSchema>;
