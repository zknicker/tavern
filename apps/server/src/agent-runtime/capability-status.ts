import { OpenClawGatewayError, OpenClawUnsupportedError } from '@tavern/openclaw-gateway-adapter';
import { z } from 'zod';
import type {
    AgentRuntimeCapability,
    AgentRuntimeCapabilityState,
} from '../agent-runtime-connection/contracts.ts';
import { emitAgentRuntimeCapabilityUpdated } from '../api/invalidation-events.ts';
import {
    getAgentRuntimeCapabilityStatus,
    markAgentRuntimeCapabilityHealthy,
    saveAgentRuntimeCapabilityStatus,
} from '../storage/agent-runtime-capability-status.ts';
import { AgentRuntimeRequestError } from './client.ts';

interface CapabilityCallInput {
    capability: AgentRuntimeCapability;
    method?: string;
    runtimeId: string;
}

interface CapabilityFailure {
    errorCode: string;
    reason: string;
    state: AgentRuntimeCapabilityState;
    technicalMessage: string;
}

export async function recordCapabilitySuccess(input: CapabilityCallInput) {
    const existing = await getAgentRuntimeCapabilityStatus(input);
    const next = await markAgentRuntimeCapabilityHealthy({
        capability: input.capability,
        method: input.method,
        runtimeId: input.runtimeId,
    });
    if (
        existing?.state !== next.state ||
        existing.errorCode !== next.errorCode ||
        existing.method !== next.method
    ) {
        emitAgentRuntimeCapabilityUpdated();
    }
}

export async function recordCapabilityFailure(input: CapabilityCallInput & { error: unknown }) {
    const failure = classifyCapabilityFailure(input.error);
    const existing = await getAgentRuntimeCapabilityStatus(input);

    const next = await saveAgentRuntimeCapabilityStatus({
        capability: input.capability,
        errorCode: failure.errorCode,
        method: input.method,
        reason: failure.reason,
        runtimeId: input.runtimeId,
        state: failure.state,
        technicalMessage: failure.technicalMessage,
    });
    if (
        existing?.state !== next.state ||
        existing.errorCode !== next.errorCode ||
        existing.method !== next.method ||
        existing.reason !== next.reason ||
        existing.technicalMessage !== next.technicalMessage
    ) {
        emitAgentRuntimeCapabilityUpdated();
    }
}

export async function withCapabilityStatus<T>(
    input: CapabilityCallInput,
    run: () => Promise<T>
): Promise<T> {
    try {
        const result = await run();
        await recordCapabilitySuccess(input);
        return result;
    } catch (error) {
        await recordCapabilityFailure({ ...input, error });
        throw error;
    }
}

export function classifyCapabilityFailure(error: unknown): CapabilityFailure {
    const code = readErrorCode(error);
    const message = readErrorMessage(error);
    const normalized = `${code} ${message}`.toLowerCase();

    if (error instanceof OpenClawUnsupportedError || normalized.includes('unsupported')) {
        return {
            errorCode: code || 'runtime_capability_unavailable',
            reason: 'This runtime does not expose the capability.',
            state: 'unavailable',
            technicalMessage: message,
        };
    }

    if (
        normalized.includes('auth') ||
        normalized.includes('credential') ||
        normalized.includes('forbidden') ||
        normalized.includes('not paired') ||
        normalized.includes('not_paired') ||
        normalized.includes('pairing') ||
        normalized.includes('permission') ||
        normalized.includes('unauthorized')
    ) {
        return {
            errorCode: code || 'runtime_capability_unauthorized',
            reason: 'Tavern is not authorized to use this runtime capability.',
            state: 'unauthorized',
            technicalMessage: message,
        };
    }

    if (error instanceof z.ZodError || normalized.includes('invalid_type')) {
        return {
            errorCode: code || 'runtime_payload_invalid',
            reason: 'The runtime returned data Tavern could not read.',
            state: 'degraded',
            technicalMessage: message,
        };
    }

    if (
        normalized.includes('timeout') ||
        normalized.includes('timed out') ||
        normalized.includes('pagination') ||
        normalized.includes('nextoffset') ||
        normalized.includes('hasmore')
    ) {
        return {
            errorCode: code || 'runtime_capability_degraded',
            reason: 'The runtime capability did not complete reliably.',
            state: 'degraded',
            technicalMessage: message,
        };
    }

    return {
        errorCode: code || 'runtime_capability_error',
        reason: 'The runtime capability failed.',
        state: 'degraded',
        technicalMessage: message,
    };
}

function readErrorCode(error: unknown) {
    if (error instanceof OpenClawGatewayError || error instanceof AgentRuntimeRequestError) {
        return error.code;
    }

    if (error && typeof error === 'object' && 'code' in error) {
        const code = (error as { code?: unknown }).code;
        if (typeof code === 'string') {
            return code;
        }
    }

    return null;
}

function readErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
}
