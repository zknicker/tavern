import * as z from 'zod';

// Dev toolkit: development-stack-only runtime helpers for exercising live
// chat surfaces (streaming turns, tool activity, failures) without a model.

export const devToolkitScenarioSchema = z.enum(['tooling', 'narration', 'failure', 'multi-agent']);
export type DevToolkitScenario = z.infer<typeof devToolkitScenarioSchema>;

export const tavernSimulateTurnRequestSchema = z.object({
    chat_id: z.string().trim().min(1),
    // Delay between scripted phases; 0 runs the whole turn synchronously
    // (tests), the default paces like a real streaming turn.
    pace_ms: z.number().int().min(0).max(10_000).optional(),
    scenario: devToolkitScenarioSchema.default('tooling'),
});
export type TavernSimulateTurnRequest = z.infer<typeof tavernSimulateTurnRequestSchema>;

export const tavernSimulateTurnReceiptSchema = z.object({
    response_id: z.string(),
    run_id: z.string(),
});
export type TavernSimulateTurnReceipt = z.infer<typeof tavernSimulateTurnReceiptSchema>;
