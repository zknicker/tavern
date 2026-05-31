import { OpenClawGatewayError, OpenClawUnsupportedError } from '@tavern/openclaw-gateway-adapter';
import { z } from 'zod';
import type {
    AgentRuntimeCapability,
    AgentRuntimeCapabilityState,
} from '../agent-runtime-connection/contracts.ts';
import { AgentRuntimeRequestError, type TavernAgentRuntimeClient } from './client.ts';

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
    void input;
}

export async function recordCapabilityFailure(input: CapabilityCallInput & { error: unknown }) {
    void input.capability;
    void input.method;
    void input.runtimeId;
    return classifyCapabilityFailure(input.error);
}

export async function recordCapabilityStatus(input: {
    capability: AgentRuntimeCapability;
    runtimeId: string;
    state: AgentRuntimeCapabilityState;
    [key: string]: unknown;
}) {
    void input;
}

export async function withCapabilityStatus<T>(
    _input: CapabilityCallInput,
    run: () => Promise<T>
): Promise<T> {
    try {
        return await run();
    } catch (error) {
        classifyCapabilityFailure(error);
        throw error;
    }
}

export async function requireRuntimeCapabilityHealthy(input: {
    capability: AgentRuntimeCapability;
    client: Pick<TavernAgentRuntimeClient, 'getCapability'>;
    runtimeId: string;
}) {
    const capability = await input.client.getCapability(input.capability);

    if (capability.healthy) {
        return capability;
    }

    throw new Error(
        capability.reason ?? `Required Runtime capability "${input.capability}" is not healthy.`
    );
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
