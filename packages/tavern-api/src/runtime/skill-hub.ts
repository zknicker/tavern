import * as z from 'zod';

/**
 * Skill hub contracts.
 *
 * The hub is the engine-owned skill catalog: multi-source search, preview,
 * install-time security scans, install/uninstall, and custom GitHub repo
 * sources ("taps"). Runtime proxies these surfaces and owns the async tail of
 * install actions; clients never talk to the engine directly.
 */

export const agentRuntimeSkillHubTrustLevelSchema = z.enum(['builtin', 'trusted', 'community']);

export const agentRuntimeSkillHubItemSchema = z.object({
    description: z.string().default(''),
    identifier: z.string().trim().min(1),
    name: z.string().trim().min(1),
    repo: z.string().trim().min(1).nullable().optional(),
    source: z.string().trim().min(1),
    tags: z.array(z.string().trim().min(1)).default([]),
    trustLevel: agentRuntimeSkillHubTrustLevelSchema,
});

export const agentRuntimeSkillHubSourceSchema = z.object({
    available: z.boolean().optional(),
    id: z.string().trim().min(1),
    label: z.string().trim().min(1),
    rateLimited: z.boolean().optional(),
});

export const agentRuntimeSkillHubInstalledEntrySchema = z.object({
    name: z.string().trim().min(1).nullable(),
    scanVerdict: z.string().trim().min(1).nullable(),
    trustLevel: z.string().trim().min(1).nullable(),
});

export const agentRuntimeSkillHubCatalogSchema = z.object({
    featured: z.array(agentRuntimeSkillHubItemSchema),
    indexAvailable: z.boolean(),
    installed: z.record(z.string(), agentRuntimeSkillHubInstalledEntrySchema),
    sources: z.array(agentRuntimeSkillHubSourceSchema),
});

export const agentRuntimeSkillHubSearchInputSchema = z.object({
    limit: z.number().int().min(1).max(50).optional(),
    query: z.string().trim().min(1).max(200),
    source: z.string().trim().min(1).optional(),
});

export const agentRuntimeSkillHubSearchResultSchema = z.object({
    installed: z.record(z.string(), agentRuntimeSkillHubInstalledEntrySchema),
    results: z.array(agentRuntimeSkillHubItemSchema),
    sourceCounts: z.record(z.string(), z.number().int().nonnegative()),
    timedOut: z.array(z.string()),
});

export const agentRuntimeSkillHubPreviewSchema = agentRuntimeSkillHubItemSchema.extend({
    files: z.array(z.string().min(1)),
    skillMd: z.string(),
});

export const agentRuntimeSkillHubScanSeveritySchema = z.enum(['critical', 'high', 'medium', 'low']);

export const agentRuntimeSkillHubScanFindingSchema = z.object({
    category: z.string(),
    description: z.string(),
    file: z.string().nullable(),
    line: z.number().int().nullable(),
    severity: agentRuntimeSkillHubScanSeveritySchema,
});

export const agentRuntimeSkillHubScanPolicySchema = z.enum(['allow', 'ask', 'block']);

export const agentRuntimeSkillHubScanSchema = z.object({
    findings: z.array(agentRuntimeSkillHubScanFindingSchema),
    identifier: z.string().trim().min(1),
    name: z.string().trim().min(1),
    policy: agentRuntimeSkillHubScanPolicySchema,
    policyReason: z.string(),
    severityCounts: z.record(z.string(), z.number().int().nonnegative()),
    source: z.string(),
    summary: z.string(),
    trustLevel: z.string(),
    verdict: z.string(),
});

export const agentRuntimeSkillHubInstallInputSchema = z.object({
    identifier: z.string().trim().min(1).max(400),
});

export const agentRuntimeSkillHubUninstallInputSchema = z.object({
    name: z.string().trim().min(1).max(200),
});

export const agentRuntimeSkillHubActionResultSchema = z.object({
    exitCode: z.number().int().nullable(),
    log: z.array(z.string()),
    ok: z.boolean(),
});

const skillHubTapRepoPattern = /^[\w.-]+\/[\w.-]+$/u;

export const agentRuntimeSkillHubTapSchema = z.object({
    path: z.string().trim().min(1).max(200).default('skills/'),
    repo: z.string().trim().regex(skillHubTapRepoPattern, 'Use the owner/repo format.'),
});

export const agentRuntimeSkillHubTapListSchema = z.object({
    taps: z.array(agentRuntimeSkillHubTapSchema),
});

export type AgentRuntimeSkillHubActionResult = z.infer<
    typeof agentRuntimeSkillHubActionResultSchema
>;
export type AgentRuntimeSkillHubCatalog = z.infer<typeof agentRuntimeSkillHubCatalogSchema>;
export type AgentRuntimeSkillHubInstallInput = z.infer<
    typeof agentRuntimeSkillHubInstallInputSchema
>;
export type AgentRuntimeSkillHubInstalledEntry = z.infer<
    typeof agentRuntimeSkillHubInstalledEntrySchema
>;
export type AgentRuntimeSkillHubItem = z.infer<typeof agentRuntimeSkillHubItemSchema>;
export type AgentRuntimeSkillHubPreview = z.infer<typeof agentRuntimeSkillHubPreviewSchema>;
export type AgentRuntimeSkillHubScan = z.infer<typeof agentRuntimeSkillHubScanSchema>;
export type AgentRuntimeSkillHubScanFinding = z.infer<typeof agentRuntimeSkillHubScanFindingSchema>;
export type AgentRuntimeSkillHubSearchInput = z.infer<typeof agentRuntimeSkillHubSearchInputSchema>;
export type AgentRuntimeSkillHubSearchResult = z.infer<
    typeof agentRuntimeSkillHubSearchResultSchema
>;
export type AgentRuntimeSkillHubSource = z.infer<typeof agentRuntimeSkillHubSourceSchema>;
export type AgentRuntimeSkillHubTap = z.infer<typeof agentRuntimeSkillHubTapSchema>;
export type AgentRuntimeSkillHubTapList = z.infer<typeof agentRuntimeSkillHubTapListSchema>;
export type AgentRuntimeSkillHubUninstallInput = z.infer<
    typeof agentRuntimeSkillHubUninstallInputSchema
>;
