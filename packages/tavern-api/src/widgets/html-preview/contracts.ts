import * as z from 'zod';
import {
    clampedWorkspaceWidgetHeightSchema,
    workspaceFilePathSchema,
    workspaceWidgetHeight,
} from '../workspace-path.ts';

/**
 * Inline sandboxed preview of an agent-authored workspace HTML file.
 * Path confinement is shared with the page widget (see workspace-path.ts).
 */

export const widgetHtmlPreviewHeight = workspaceWidgetHeight;

export const widgetHtmlPreviewPropsSchema = z
    .object({
        height: clampedWorkspaceWidgetHeightSchema.optional(),
        path: workspaceFilePathSchema(/\.html?$/iu, 'Path must point at an .html or .htm file.'),
        title: z.string().trim().min(1).max(120).optional(),
    })
    .strict();

export type WidgetHtmlPreviewProps = z.output<typeof widgetHtmlPreviewPropsSchema>;
