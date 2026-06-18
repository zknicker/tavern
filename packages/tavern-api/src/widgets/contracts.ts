import * as z from 'zod';

export const widgetRenderTargetSchema = z.enum(['chat.inline']);

export const widgetRenderFallbackSchema = z
    .object({
        text: z.string().trim().min(1).max(500),
    })
    .strict();

export const widgetRenderInputSchema = z
    .object({
        component: z.string().trim().min(1).max(120),
        fallback: widgetRenderFallbackSchema,
        props: z.unknown(),
        target: widgetRenderTargetSchema,
    })
    .strict();

export type WidgetRenderInput = z.infer<typeof widgetRenderInputSchema>;
export type WidgetRenderTarget = z.infer<typeof widgetRenderTargetSchema>;
