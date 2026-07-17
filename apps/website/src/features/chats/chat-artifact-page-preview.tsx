import { useMemo } from 'react';
import { useResolvedThemeOptional } from '../../components/theme-provider.tsx';
import {
    pageRuntimeCss,
    pageRuntimeJs,
} from '../../widgets/page-runtime/generated/page-runtime.ts';
import { buildPageSrcDoc } from '../../widgets/page-runtime/page-doc.ts';
import { workspaceIframeSandbox } from '../../widgets/sandbox.ts';
import { WorkspaceArtifactEmpty } from './chat-artifact-workspace-preview.tsx';

/**
 * Artifact-pane renderer for agent-authored .tsx pages. The page runtime
 * compiles the source with sucrase inside the opaque-origin iframe and mounts
 * it with React plus the kit bundle; compile or render failures show the
 * error and the fenced source inside the same frame, never a partial page.
 */
export function WorkspacePagePreview({
    content,
    path,
    truncated,
}: {
    content: string;
    path: string;
    truncated: boolean;
}) {
    const scheme = useResolvedThemeOptional();
    const srcDoc = useMemo(
        () =>
            truncated
                ? null
                : buildPageSrcDoc({
                      runtimeCss: pageRuntimeCss,
                      runtimeJs: pageRuntimeJs,
                      scheme,
                      source: content,
                  }),
        [content, scheme, truncated]
    );

    if (srcDoc === null) {
        return (
            <WorkspaceArtifactEmpty
                detail="This file is too large to render (512 KB limit)."
                title={path}
            />
        );
    }

    return (
        <iframe
            className="h-full min-h-0 w-full"
            sandbox={workspaceIframeSandbox}
            srcDoc={srcDoc}
            style={{ colorScheme: scheme }}
            title={path}
        />
    );
}
