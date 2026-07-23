import { clearCompositionHandoff, observeToolCallForComposition } from './agent-compositions.ts';

// Harness stream observer (I1/D1): with CLI-only output, a turn's stream is
// execution evidence, not chat content. The observer keeps the session's
// context-size fact, and watches shell tool calls for in-flight
// `grotto message send` commands to drive the composition stream. Nothing
// here writes durable chat rows.

export interface HarnessStreamObservation {
    aborted: boolean;
    contextTokens: number | null;
    streamError: unknown;
}

export async function observeHarnessTurnStream(
    input: { agentId: string },
    stream: AsyncIterable<unknown>
): Promise<HarnessStreamObservation> {
    const observation: HarnessStreamObservation = {
        aborted: false,
        contextTokens: null,
        streamError: undefined,
    };

    for await (const part of stream) {
        if (!isStreamPart(part)) {
            continue;
        }
        switch (part.type) {
            case 'tool-call':
                observeToolCallForComposition({
                    agentId: input.agentId,
                    toolInput: part.input,
                });
                continue;
            case 'tool-result':
            case 'tool-error':
                clearCompositionHandoff(input.agentId);
                continue;
            case 'finish-step':
                // The final step's context is the session's context size.
                observation.contextTokens =
                    usageContextTokens(part.usage) ?? observation.contextTokens;
                continue;
            case 'finish':
                // totalUsage sums every step, so it only serves as a fallback
                // when the harness never reported per-step usage.
                observation.contextTokens ??= usageContextTokens(part.totalUsage);
                continue;
            case 'error':
                observation.streamError ??=
                    (part as { error?: unknown }).error ?? new Error('Harness stream failed.');
                continue;
            case 'abort':
                observation.aborted = true;
                continue;
            default:
                continue;
        }
    }
    clearCompositionHandoff(input.agentId);

    if (observation.streamError && !observation.aborted) {
        throw observation.streamError instanceof Error
            ? observation.streamError
            : new Error(String(observation.streamError));
    }
    return observation;
}

function usageContextTokens(usage: unknown): number | null {
    if (!isRecord(usage)) {
        return null;
    }
    const inputTotal = tokenTotal(usage.inputTokens);
    const outputTotal = tokenTotal(usage.outputTokens);
    if (inputTotal === null && outputTotal === null) {
        return null;
    }
    return (inputTotal ?? 0) + (outputTotal ?? 0);
}

function tokenTotal(group: unknown): number | null {
    if (!isRecord(group)) {
        return null;
    }
    return typeof group.total === 'number' && Number.isFinite(group.total) ? group.total : null;
}

function isStreamPart(part: unknown): part is { type: string } & Record<string, unknown> {
    return isRecord(part) && typeof part.type === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
