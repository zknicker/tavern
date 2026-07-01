import * as z from 'zod';
import {
    agentRuntimeCapabilityHealthIdSchema,
    agentRuntimePluginIdSchema,
} from '../runtime/contracts.ts';

const pluginManifestNameSchema = z.string().trim().min(1).max(128);

export const tavernPluginSecretManifestSchema = z
    .object({
        name: pluginManifestNameSchema,
    })
    .strict();

export const tavernPluginSkillManifestSchema = z
    .object({
        name: pluginManifestNameSchema,
        runtimeSource: pluginManifestNameSchema,
    })
    .strict();

export const tavernPluginToolGroupManifestSchema = z
    .object({
        description: z.string().trim().min(1).max(240),
        id: pluginManifestNameSchema,
        label: pluginManifestNameSchema,
        tools: z.array(pluginManifestNameSchema),
    })
    .strict();

export const tavernPluginRichResponseComponentManifestSchema = z
    .object({
        type: pluginManifestNameSchema,
    })
    .strict();

export const tavernPluginManifestSchema = z
    .object({
        description: z.string().trim().min(1).max(240),
        displayName: pluginManifestNameSchema,
        healthCapabilities: z.array(agentRuntimeCapabilityHealthIdSchema),
        id: agentRuntimePluginIdSchema,
        richResponseComponents: z.array(tavernPluginRichResponseComponentManifestSchema),
        secrets: z.array(tavernPluginSecretManifestSchema),
        settings: z.array(pluginManifestNameSchema),
        skills: z.array(tavernPluginSkillManifestSchema),
        toolGroups: z.array(tavernPluginToolGroupManifestSchema),
        version: pluginManifestNameSchema,
    })
    .strict();

export type TavernPluginManifest = z.infer<typeof tavernPluginManifestSchema>;
