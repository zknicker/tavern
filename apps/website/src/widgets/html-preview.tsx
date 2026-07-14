import {
    type WidgetHtmlPreviewProps,
    widgetHtmlPreviewHeight,
} from '@tavern/api/widgets/html-preview';
import { WidgetFrame } from '../components/widgets/widget-frame.tsx';
import { trpc } from '../lib/trpc.tsx';

// Opaque-origin sandbox, matching the artifact pane's HTML preview. Never add
// allow-same-origin: the agent-authored document must not reach the app
// origin's cookies, storage, or DOM.
const htmlPreviewSandbox = 'allow-forms allow-modals allow-pointer-lock allow-popups allow-scripts';

export function WidgetHtmlPreview({
    agentId,
    props,
}: {
    agentId: string | null;
    props: WidgetHtmlPreviewProps;
}) {
    const fileQuery = trpc.agent.workspaceReadableFile.useQuery(
        { agentId: agentId ?? '', path: props.path },
        { enabled: Boolean(agentId) }
    );

    return (
        <WidgetFrame
            contentClassName="overflow-hidden p-0"
            size="full"
            title={props.title ?? props.path}
        >
            {agentId ? (
                <WidgetHtmlPreviewBody
                    file={fileQuery.data}
                    height={props.height ?? widgetHtmlPreviewHeight.default}
                    path={props.path}
                    status={fileQuery.status}
                />
            ) : (
                <HtmlPreviewNote text="This preview is only available for agent-authored replies." />
            )}
        </WidgetFrame>
    );
}

interface HtmlPreviewFile {
    binary: boolean;
    content: string;
    mediaType: string;
    truncated: boolean;
}

/**
 * Presentational body, split from the query so tests can drive every state.
 * The mediaType/binary/truncated checks back up the fence schema: only a
 * complete workspace text/html read reaches the iframe.
 */
export function WidgetHtmlPreviewBody({
    file,
    height,
    path,
    status,
}: {
    file: HtmlPreviewFile | undefined;
    height: number;
    path: string;
    status: 'error' | 'pending' | 'success';
}) {
    if (status === 'error') {
        return <HtmlPreviewNote text="Unable to load this file from the agent workspace." />;
    }

    if (status === 'pending' || !file) {
        return <HtmlPreviewNote text="Loading preview..." />;
    }

    if (file.binary || file.mediaType !== 'text/html') {
        return <HtmlPreviewNote text="This file is not previewable HTML." />;
    }

    if (file.truncated) {
        return <HtmlPreviewNote text="This file is too large to preview (5 MB limit)." />;
    }

    return (
        <iframe
            className="block w-full border-0 bg-white"
            sandbox={htmlPreviewSandbox}
            srcDoc={file.content}
            style={{ height }}
            title={path}
        />
    );
}

function HtmlPreviewNote({ text }: { text: string }) {
    return <p className="px-4 py-6 text-muted-foreground text-sm leading-5">{text}</p>;
}
