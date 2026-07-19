import * as React from 'react';
import { useResolvedThemeOptional } from '../../components/theme-provider.tsx';
import type { AgentListOutput } from '../../lib/trpc.tsx';
import { trpc } from '../../lib/trpc.tsx';
import { workspaceIframeSandbox } from '../../widgets/sandbox.ts';
import {
    injectHostTokenStyle,
    readHostFontFaceCss,
    readHostTokenCss,
} from '../chats/host-token-style.ts';
import starterHtml from './home-canvas-starter.html?raw';

type Agent = AgentListOutput['agents'][number];

// The home canvas (specs/home-brief.md): an agent-authored HTML page at
// workbench/home.html, maintained by the Home brief automation and rendered
// in the sandboxed artifact frame with the host token and font bridge. Any
// agent may own the file; the freshest copy across agents wins. When nobody
// has authored one yet, the shipped starter renders instead.
export const homeCanvasPath = 'workbench/home.html';

const defaultCanvasHeight = 200;
const minCanvasHeight = 120;
const maxCanvasHeight = 720;

/** Height contract: `<meta name="tavern-canvas-height" content="240">`. */
export function parseCanvasHeight(html: string): number {
    const match = /<meta\s+name="tavern-canvas-height"\s+content="(\d{2,4})"/iu.exec(html);

    if (!match?.[1]) {
        return defaultCanvasHeight;
    }

    const height = Number.parseInt(match[1], 10);

    return Math.min(maxCanvasHeight, Math.max(minCanvasHeight, height));
}

export function HomeCanvas({ agents }: { agents: Agent[] }) {
    const scheme = useResolvedThemeOptional() === 'dark' ? 'dark' : 'light';

    // One bounded read per agent; the freshest authored copy wins. Polling
    // stands in for a file-change subscription until one exists.
    const fileQueries = trpc.useQueries((query) =>
        agents.map((agent) =>
            query.agent.workspaceReadableFile(
                { agentId: agent.id, path: homeCanvasPath },
                { refetchInterval: 60_000, retry: false }
            )
        )
    );
    const authored = fileQueries
        .map((result) => result.data)
        .filter(
            (file): file is NonNullable<typeof file> =>
                Boolean(file) && file?.mediaType === 'text/html' && !file.binary
        )
        .sort((a, b) => ((a.updatedAt ?? '') < (b.updatedAt ?? '') ? 1 : -1))[0];
    const html = authored?.content ?? starterHtml;

    const srcDoc = React.useMemo(
        () => injectHostTokenStyle(html, `${readHostTokenCss(scheme)}${readHostFontFaceCss()}`),
        [html, scheme]
    );
    const height = parseCanvasHeight(html);

    return (
        <iframe
            className="w-full"
            sandbox={workspaceIframeSandbox}
            srcDoc={srcDoc}
            style={{ border: 0, colorScheme: scheme, height }}
            title="Home"
        />
    );
}
