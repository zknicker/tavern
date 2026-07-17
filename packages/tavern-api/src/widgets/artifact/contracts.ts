import * as z from 'zod';
import { workspaceFilePathSchema } from '../workspace-path.ts';

/**
 * Durable agent artifact: a single-file TSX page authored in the agent
 * workspace. The chat transcript renders a compact card; opening it renders
 * the compiled page in the artifact pane's sandboxed iframe (React plus the
 * Tavern component kit; only those two import sources resolve). Authored as
 * a bare `artifact` fence — see widgetFenceLabel in ../contracts.ts. Path
 * confinement mirrors html-preview (see workspace-path.ts).
 */

export const widgetArtifactPropsSchema = z
    .object({
        path: workspaceFilePathSchema(/\.tsx$/iu, 'Path must point at a .tsx file.'),
        title: z.string().trim().min(1).max(120).optional(),
    })
    .strict();

export type WidgetArtifactProps = z.output<typeof widgetArtifactPropsSchema>;
