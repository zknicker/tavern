import * as z from 'zod';

/**
 * Inline sandboxed preview of an agent-authored workspace HTML file.
 *
 * Fence props are attacker-controlled: this schema enforces shape only
 * (workspace-relative path, confined segments, .html/.htm extension). Real
 * confinement happens where the file is read — the Runtime workspace file
 * read resolves the path against the sending agent's workspace root with
 * realpath checks, secret-file blocks, and size caps.
 */

export const widgetHtmlPreviewHeight = { default: 480, max: 1200, min: 120 } as const;

const workspaceHtmlPathSchema = z
    .string()
    .trim()
    .min(1)
    .max(512)
    .refine((value) => !(value.startsWith('/') || value.includes('\\')), {
        message: 'Path must be workspace-relative and use forward slashes.',
    })
    .refine(
        (value) =>
            value
                .split('/')
                .every((segment) => segment.length > 0 && segment !== '.' && segment !== '..'),
        { message: 'Path must stay inside the agent workspace.' }
    )
    .refine((value) => /\.html?$/iu.test(value), {
        message: 'Path must point at an .html or .htm file.',
    });

const clampedHeightSchema = z
    .number()
    .finite()
    .transform((value) =>
        Math.round(
            Math.min(widgetHtmlPreviewHeight.max, Math.max(widgetHtmlPreviewHeight.min, value))
        )
    );

export const widgetHtmlPreviewPropsSchema = z
    .object({
        height: clampedHeightSchema.optional(),
        path: workspaceHtmlPathSchema,
        title: z.string().trim().min(1).max(120).optional(),
    })
    .strict();

export type WidgetHtmlPreviewProps = z.output<typeof widgetHtmlPreviewPropsSchema>;
