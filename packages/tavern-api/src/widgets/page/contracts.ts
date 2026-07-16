import * as z from 'zod';
import {
    clampedWorkspaceWidgetHeightSchema,
    workspaceFilePathSchema,
    workspaceWidgetHeight,
} from '../workspace-path.ts';

/**
 * Sandboxed inline render of an agent-authored single-file TSX page. The app
 * compiles the file inside an opaque-origin iframe and renders it with React
 * plus the Tavern component kit; only React and the kit alias are importable.
 * Path confinement mirrors html-preview (see workspace-path.ts).
 */

export const widgetPageHeight = workspaceWidgetHeight;

export const widgetPagePropsSchema = z
    .object({
        height: clampedWorkspaceWidgetHeightSchema.optional(),
        path: workspaceFilePathSchema(/\.tsx$/iu, 'Path must point at a .tsx file.'),
        title: z.string().trim().min(1).max(120).optional(),
    })
    .strict();

export type WidgetPageProps = z.output<typeof widgetPagePropsSchema>;
