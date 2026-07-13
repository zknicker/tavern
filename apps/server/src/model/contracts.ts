import {
    agentRuntimeModelCapabilitySchema,
    agentRuntimeModelProviderIdSchema,
    parseAgentRuntimeModelRef,
} from '@tavern/api';
import { z } from 'zod';

export const modelAvailabilitySchema = z.enum([
    'available',
    'configured',
    'degraded',
    'unavailable',
]);
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
    capability: agentRuntimeModelCapabilitySchema,
    contextWindow: z.number().int().positive().nullable(),
    framework: z.string().min(1),
    id: z.string().min(1),
    modelId: z.string().min(1),
    name: z.string().min(1),
    provider: agentRuntimeModelProviderIdSchema,
    ref: modelRefSchema,
    reasoning: z.boolean().nullable(),
    supportsChatRouting: z.boolean(),
});

export const agentModelSettingSchema = z.object({
    agentId: z.string().min(1),
    agentName: z.string().min(1),
    model: z.string().min(1).nullable(),
    modelRef: modelRefSchema.nullable(),
    provider: z.string().min(1).nullable(),
    syncError: z.string().nullable(),
    syncedAt: z.string().nullable(),
    effectiveThinkingDefault: thinkingLevelSchema.nullable(),
    isOverridden: z.boolean(),
    isThinkingOverridden: z.boolean(),
    overrideThinkingDefault: thinkingLevelSchema.nullable(),
});

export const openRouterSettingsSchema = z.object({
    hasApiKey: z.boolean(),
    updatedAt: z.string().nullable(),
});

export const modelListSchema = z.object({
    agents: z.array(agentModelSettingSchema),
    defaultsThinkingLevel: thinkingLevelSchema.nullable(),
    models: z.array(modelSchema),
    openRouter: openRouterSettingsSchema,
    subAgentThinkingLevel: thinkingLevelSchema.nullable(),
});

export type AgentModelSetting = z.infer<typeof agentModelSettingSchema>;
export type Model = z.infer<typeof modelSchema>;
export type ModelList = z.infer<typeof modelListSchema>;
