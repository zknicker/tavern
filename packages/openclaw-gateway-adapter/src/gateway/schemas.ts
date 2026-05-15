import * as z from 'zod';

const openClawJsonRecordSchema = z.record(z.string(), z.unknown());

export const openClawChallengeEventSchema = z.object({
    event: z.literal('connect.challenge'),
    payload: z.object({
        nonce: z.string(),
        ts: z.number().optional(),
    }),
    type: z.literal('event'),
});

export const openClawGatewayEventFrameSchema = z.object({
    event: z.string().trim().min(1),
    payload: z.unknown().optional(),
    seq: z.number().optional(),
    stateVersion: z.unknown().optional(),
    type: z.literal('event'),
});

export const openClawGatewayResponseFrameSchema = z.object({
    error: z
        .object({
            code: z.string().optional(),
            details: z.unknown().optional(),
            message: z.string().optional(),
            retryable: z.boolean().optional(),
            retryAfterMs: z.number().optional(),
        })
        .optional(),
    id: z.string().trim().min(1),
    ok: z.boolean(),
    payload: z.unknown().optional(),
    type: z.literal('res'),
});

export const openClawGatewayFrameSchema = z.discriminatedUnion('type', [
    openClawGatewayEventFrameSchema,
    openClawGatewayResponseFrameSchema,
]);

export const openClawGatewayHelloSchema = z.object({
    auth: openClawJsonRecordSchema.optional(),
    features: openClawJsonRecordSchema.optional(),
    policy: openClawJsonRecordSchema.optional(),
    protocol: z.number().optional(),
    type: z.string().optional(),
});

export type OpenClawGatewayResponseFrame = z.infer<typeof openClawGatewayResponseFrameSchema>;
