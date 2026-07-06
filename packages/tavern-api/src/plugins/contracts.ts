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

export const tavernPluginOAuthManifestSchema = z
    .object({
        baseScopes: z.array(z.string().trim().min(1)),
        kind: z.literal('oauth2'),
        pkce: z.literal(true),
        provider: pluginManifestNameSchema,
        redirect: z.literal('loopback'),
    })
    .strict();

export const tavernPluginServiceManifestSchema = z
    .object({
        defaultEnabled: z.boolean().default(false),
        description: z.string().trim().min(1).max(240),
        displayName: pluginManifestNameSchema,
        healthCapabilities: z.array(agentRuntimeCapabilityHealthIdSchema).default([]),
        id: pluginManifestNameSchema,
        scopes: z.array(z.string().trim().min(1)).default([]),
        skills: z.array(tavernPluginSkillManifestSchema),
        toolGroups: z.array(tavernPluginToolGroupManifestSchema),
    })
    .strict();

export const tavernPluginManifestSchema = z
    .object({
        description: z.string().trim().min(1).max(240),
        displayName: pluginManifestNameSchema,
        healthCapabilities: z.array(agentRuntimeCapabilityHealthIdSchema),
        auth: tavernPluginOAuthManifestSchema.nullable().default(null),
        id: agentRuntimePluginIdSchema,
        richResponseComponents: z.array(tavernPluginRichResponseComponentManifestSchema),
        secrets: z.array(tavernPluginSecretManifestSchema),
        services: z.array(tavernPluginServiceManifestSchema).min(1),
        settings: z.array(pluginManifestNameSchema),
        version: pluginManifestNameSchema,
    })
    .strict();

export type TavernPluginManifest = z.infer<typeof tavernPluginManifestSchema>;
export type TavernPluginServiceManifest = z.infer<typeof tavernPluginServiceManifestSchema>;
