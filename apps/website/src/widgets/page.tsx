import { type WidgetPageProps, widgetPageHeight } from '@tavern/api/widgets/page';
import { useMemo } from 'react';
import { useResolvedThemeOptional } from '../components/theme-provider.tsx';
import { Card } from '../kit/index.ts';
import { trpc } from '../lib/trpc.tsx';
import { pageRuntimeCss, pageRuntimeJs } from './page-runtime/generated/page-runtime.ts';
import { buildPageSrcDoc } from './page-runtime/page-doc.ts';
import { workspaceIframeSandbox } from './sandbox.ts';

const pageRuntime = { css: pageRuntimeCss, js: pageRuntimeJs };

export function WidgetPage({ agentId, props }: { agentId: string | null; props: WidgetPageProps }) {
    const scheme = useResolvedThemeOptional();
    const fileQuery = trpc.agent.workspaceReadableFile.useQuery(
        { agentId: agentId ?? '', path: props.path },
        { enabled: Boolean(agentId) }
    );

    return (
        <Card contentClassName="overflow-hidden p-0" size="full" title={props.title ?? props.path}>
            {agentId ? (
                <WidgetPageBody
                    file={fileQuery.data}
                    height={props.height ?? widgetPageHeight.default}
                    path={props.path}
                    runtime={pageRuntime}
                    scheme={scheme}
                    status={fileQuery.status}
                />
            ) : (
                <PageNote text="This page is only available for agent-authored replies." />
            )}
        </Card>
    );
}

interface PageFile {
    binary: boolean;
    content: string;
    language: string | null;
    truncated: boolean;
}

/**
 * Presentational body, split from the query so tests can drive every state.
 * The language/binary/truncated checks back up the fence schema: only a
 * complete workspace TSX text read reaches the sandboxed iframe, where the
 * page-runtime script compiles and mounts it.
 */
export function WidgetPageBody({
    file,
    height,
    path,
    runtime,
    scheme,
    status,
}: {
    file: PageFile | undefined;
    height: number;
    path: string;
    runtime: { css: string; js: string };
    scheme: 'dark' | 'light';
    status: 'error' | 'pending' | 'success';
}) {
    const ready = status === 'success' && file && !file.binary && file.language === 'tsx';
    const source = ready && !file.truncated ? file.content : null;
    const srcDoc = useMemo(
        () =>
            source === null
                ? null
                : buildPageSrcDoc({
                      runtimeCss: runtime.css,
                      runtimeJs: runtime.js,
                      scheme,
                      source,
                  }),
        [runtime.css, runtime.js, scheme, source]
    );

    if (status === 'error') {
        return <PageNote text="Unable to load this file from the agent workspace." />;
    }

    if (status === 'pending' || !file) {
        return <PageNote text="Loading page..." />;
    }

    if (file.binary || file.language !== 'tsx') {
        return <PageNote text="This file is not a renderable TSX page." />;
    }

    if (file.truncated || srcDoc === null) {
        return <PageNote text="This file is too large to render (512 KB limit)." />;
    }

    return (
        <iframe
            className="block w-full border-0"
            sandbox={workspaceIframeSandbox}
            srcDoc={srcDoc}
            style={{ colorScheme: scheme, height }}
            title={path}
        />
    );
}

function PageNote({ text }: { text: string }) {
    return <p className="px-4 py-6 text-muted-foreground text-sm leading-5">{text}</p>;
}
