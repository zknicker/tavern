interface CortexLlmAuditMetadataInput {
    estimatedCostUsd?: number | null;
    extra?: Record<string, unknown>;
    latencyMs?: number;
    model: string;
    outputHash?: string;
    promptHash: string;
    provider: string;
    requestId?: string | null;
    route: string;
    sourceHash: string;
    tokenCounts?: Record<string, unknown> | null;
}

export function buildCortexLlmAuditMetadata(
    input: CortexLlmAuditMetadataInput
): Record<string, unknown> {
    return {
        ...input.extra,
        latencyMs: input.latencyMs ?? null,
        estimatedCostUsd: input.estimatedCostUsd ?? null,
        model: input.model,
        outputHash: input.outputHash ?? null,
        promptHash: input.promptHash,
        provider: input.provider,
        requestId: input.requestId ?? null,
        route: input.route,
        sourceHash: input.sourceHash,
        tokenCounts: input.tokenCounts ?? null,
    };
}
