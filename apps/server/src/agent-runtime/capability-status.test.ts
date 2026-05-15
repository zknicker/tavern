import { expect, test } from 'bun:test';
import { OpenClawGatewayError, OpenClawUnsupportedError } from '@tavern/openclaw-gateway-adapter';
import { z } from 'zod';
import { classifyCapabilityFailure } from './capability-status.ts';
import { AgentRuntimeRequestError } from './client.ts';

test('classifyCapabilityFailure maps unsupported runtime surfaces to unavailable', () => {
    expect(
        classifyCapabilityFailure(new OpenClawUnsupportedError('models.list unsupported'))
    ).toMatchObject({
        state: 'unavailable',
    });
});

test('classifyCapabilityFailure maps authorization failures to unauthorized', () => {
    expect(
        classifyCapabilityFailure(
            new OpenClawGatewayError({
                code: 'unauthorized',
                message: 'Unauthorized',
            })
        )
    ).toMatchObject({
        state: 'unauthorized',
    });
});

test('classifyCapabilityFailure maps malformed payloads to degraded', () => {
    expect(classifyCapabilityFailure(new z.ZodError([]))).toMatchObject({
        errorCode: 'runtime_payload_invalid',
        state: 'degraded',
    });
});

test('classifyCapabilityFailure maps timeout-like failures to degraded', () => {
    expect(
        classifyCapabilityFailure(
            new AgentRuntimeRequestError({
                code: 'runtime_timeout',
                message: 'runtime request timed out',
                retryable: true,
                status: 504,
            })
        )
    ).toMatchObject({
        state: 'degraded',
    });
});
