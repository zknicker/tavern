import * as React from 'react';
import { Card, CardContent } from '../../components/ui/card.tsx';
import { CodeSnippet } from '../../components/ui/code-snippet.tsx';
import { useCortexListSuspense } from '../../hooks/cortex/use-cortex-list.ts';
import { useCortexStatusSuspense } from '../../hooks/cortex/use-cortex-status.ts';
import type { CortexListOutput } from '../../lib/trpc.tsx';

type CortexPageNode = CortexListOutput['pages'][number];

interface GraphNode {
    id: string;
    isGhost: boolean;
    page: CortexPageNode | null;
    slug: string;
    title: string;
    type: string;
    x: number;
    y: number;
}

interface GraphEdge {
    from: string;
    id: string;
    to: string;
}

interface HitCircle {
    radius: number;
    slug: string;
    x: number;
    y: number;
}

export function Cortex() {
    const [list] = useCortexListSuspense();
    const [status] = useCortexStatusSuspense();
    const [selectedSlug, setSelectedSlug] = React.useState<string | null>(null);
    const selectedPage = resolveSelectedPage(list, selectedSlug);

    React.useEffect(() => {
        if (!(selectedPage && selectedSlug)) {
            setSelectedSlug(selectedPage?.slug ?? null);
        }
    }, [selectedPage, selectedSlug]);

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-5 px-4 pt-4 pb-4">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div className="max-w-3xl">
                    <h1 className="font-semibold text-2xl">Cortex</h1>
                    <p className="mt-2 text-muted-foreground text-sm leading-6">
                        A linked markdown brain for durable knowledge, source-backed facts, and
                        agent-readable context.
                    </p>
                </div>
                <div className="grid grid-cols-3 overflow-hidden rounded-xl border bg-card text-sm">
                    <Metric label="Pages" value={status?.pageCount ?? list.pages.length} />
                    <Metric label="Links" value={status?.linkCount ?? countLinks(list)} />
                    <Metric
                        label="Encodings"
                        value={
                            status
                                ? `${status.encoding.currentCount}/${status.encoding.totalCount}`
                                : '0/0'
                        }
                    />
                </div>
            </header>

            <section className="grid min-h-[640px] flex-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
                <CortexPageList
                    onSelect={setSelectedSlug}
                    pages={list.pages}
                    selectedSlug={selectedPage?.slug ?? null}
                    wikiPath={status?.wikiPath ?? null}
                />
                <CortexGraphPanel
                    onSelect={setSelectedSlug}
                    pages={list.pages}
                    selectedSlug={selectedPage?.slug ?? null}
                />
            </section>
        </div>
    );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="min-w-28 border-border/70 border-r px-4 py-3 last:border-r-0">
            <div className="text-muted-foreground text-xs">{label}</div>
            <div className="mt-1 font-semibold text-foreground text-sm">{value}</div>
        </div>
    );
}

function CortexPageList({
    onSelect,
    pages,
    selectedSlug,
    wikiPath,
}: {
    onSelect: (slug: string) => void;
    pages: CortexPageNode[];
    selectedSlug: string | null;
    wikiPath: string | null;
}) {
    return (
        <Card className="min-h-0 overflow-hidden p-0">
            <CardContent className="flex min-h-0 flex-col p-0">
                <div className="border-b px-4 py-3">
                    <div className="font-medium text-sm">Markdown Entities</div>
                    <div className="mt-1 text-muted-foreground text-xs">
                        {pages.length} page{pages.length === 1 ? '' : 's'} in the Cortex wiki
                    </div>
                </div>
                {wikiPath ? (
                    <div className="border-b bg-muted/20 px-4 py-3">
                        <CodeSnippet lines={wikiPath} />
                    </div>
                ) : null}
                <div className="min-h-0 flex-1 overflow-auto">
                    {pages.length === 0 ? (
                        <div className="p-5 text-muted-foreground text-sm">
                            No Cortex markdown pages captured yet.
                        </div>
                    ) : (
                        pages.map((page) => (
                            <button
                                className="group flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-muted/45 data-[active=true]:bg-brand-muted/60"
                                data-active={page.slug === selectedSlug}
                                key={page.id}
                                onClick={() => onSelect(page.slug)}
                                type="button"
                            >
                                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-brand shadow-[0_0_0_4px_rgb(59_130_246/0.10)] group-data-[active=true]:bg-foreground" />
                                <span className="min-w-0 flex-1">
                                    <span className="flex min-w-0 items-center justify-between gap-3">
                                        <span className="truncate font-medium text-sm">
                                            {page.title}
                                        </span>
                                        <span className="shrink-0 rounded border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground">
                                            {page.type}
                                        </span>
                                    </span>
                                    <span className="mt-1 block truncate text-muted-foreground text-xs">
                                        {page.slug}.md
                                    </span>
                                    {page.tags.length > 0 ? (
                                        <span className="mt-2 flex flex-wrap gap-1">
                                            {page.tags.slice(0, 3).map((tag) => (
                                                <span
                                                    className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                                                    key={tag}
                                                >
                                                    #{tag}
                                                </span>
                                            ))}
                                        </span>
                                    ) : null}
                                </span>
                            </button>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function CortexGraphPanel({
    onSelect,
    pages,
    selectedSlug,
}: {
    onSelect: (slug: string) => void;
    pages: CortexPageNode[];
    selectedSlug: string | null;
}) {
    const selectedPage = pages.find((page) => page.slug === selectedSlug) ?? pages[0] ?? null;

    return (
        <Card className="relative min-h-0 overflow-hidden p-0">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 p-5">
                <div>
                    <div className="font-semibold text-lg">Knowledge Graph</div>
                    <div className="mt-1 max-w-xl text-muted-foreground text-sm">
                        Wiki links become edges. Unresolved links stay visible as quiet ghost nodes.
                    </div>
                </div>
                {selectedPage ? (
                    <div className="max-w-xs rounded-lg border bg-background/90 px-3 py-2 shadow-sm backdrop-blur">
                        <div className="truncate font-medium text-sm">{selectedPage.title}</div>
                        <div className="mt-1 truncate text-muted-foreground text-xs">
                            {selectedPage.slug}.md
                        </div>
                    </div>
                ) : null}
            </div>
            <CortexGraphCanvas onSelect={onSelect} pages={pages} selectedSlug={selectedSlug} />
        </Card>
    );
}

function CortexGraphCanvas({
    onSelect,
    pages,
    selectedSlug,
}: {
    onSelect: (slug: string) => void;
    pages: CortexPageNode[];
    selectedSlug: string | null;
}) {
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const hitCirclesRef = React.useRef<HitCircle[]>([]);
    const graph = React.useMemo(() => buildGraph(pages), [pages]);

    React.useEffect(() => {
        const canvas = canvasRef.current;
        const parent = canvas?.parentElement;
        if (!(canvas && parent)) {
            return;
        }

        const draw = () => {
            const rect = parent.getBoundingClientRect();
            const pixelRatio = window.devicePixelRatio || 1;
            canvas.width = Math.max(1, Math.floor(rect.width * pixelRatio));
            canvas.height = Math.max(1, Math.floor(rect.height * pixelRatio));
            canvas.style.width = `${rect.width}px`;
            canvas.style.height = `${rect.height}px`;

            const context = canvas.getContext('2d');
            if (!context) {
                return;
            }

            context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
            hitCirclesRef.current = drawGraph(context, {
                graph,
                height: rect.height,
                selectedSlug,
                width: rect.width,
            });
        };

        draw();
        const observer = new ResizeObserver(draw);
        observer.observe(parent);
        return () => observer.disconnect();
    }, [graph, selectedSlug]);

    const handlePointerMove = React.useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }

        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const hit = hitCirclesRef.current.find((circle) => {
            const distance = Math.hypot(circle.x - x, circle.y - y);
            return distance <= circle.radius;
        });
        canvas.style.cursor = hit ? 'pointer' : 'default';
    }, []);

    const handleClick = React.useCallback(
        (event: React.PointerEvent<HTMLCanvasElement>) => {
            const canvas = canvasRef.current;
            if (!canvas) {
                return;
            }

            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            const hit = hitCirclesRef.current.find((circle) => {
                const distance = Math.hypot(circle.x - x, circle.y - y);
                return distance <= circle.radius;
            });
            if (hit) {
                onSelect(hit.slug);
            }
        },
        [onSelect]
    );

    return (
        <div className="relative h-full min-h-[640px] overflow-hidden bg-[radial-gradient(circle_at_20%_20%,rgb(14_165_233/0.10),transparent_32%),linear-gradient(135deg,rgb(250_250_249),rgb(245_245_244))] dark:bg-[radial-gradient(circle_at_20%_20%,rgb(14_165_233/0.18),transparent_32%),linear-gradient(135deg,rgb(12_12_10),rgb(28_25_23))]">
            <canvas
                aria-label="Cortex knowledge graph"
                className="absolute inset-0 h-full w-full"
                onClick={handleClick}
                onPointerMove={handlePointerMove}
                ref={canvasRef}
            />
        </div>
    );
}

function buildGraph(pages: CortexPageNode[]) {
    const nodesBySlug = new Map<string, GraphNode>();
    for (const [index, page] of pages.entries()) {
        nodesBySlug.set(page.slug, {
            id: page.id,
            isGhost: false,
            page,
            slug: page.slug,
            title: page.title,
            type: page.type,
            x: 0,
            y: 0,
        });
        assignSeedPosition(nodesBySlug.get(page.slug) as GraphNode, index, pages.length);
    }

    const edges: GraphEdge[] = [];
    for (const page of pages) {
        for (const link of page.links) {
            const targetSlug = link.targetSlug;
            if (!nodesBySlug.has(targetSlug)) {
                const ghost: GraphNode = {
                    id: targetSlug,
                    isGhost: true,
                    page: null,
                    slug: targetSlug,
                    title: targetSlug,
                    type: 'unresolved',
                    x: 0,
                    y: 0,
                };
                assignSeedPosition(ghost, nodesBySlug.size, pages.length + 1);
                nodesBySlug.set(targetSlug, ghost);
            }
            edges.push({
                from: page.slug,
                id: link.id,
                to: targetSlug,
            });
        }
    }

    return { edges, nodes: Array.from(nodesBySlug.values()) };
}

function assignSeedPosition(node: GraphNode, index: number, total: number) {
    const ring = index % 2 === 0 ? 0.36 : 0.48;
    const angle = (Math.PI * 2 * index) / Math.max(total, 1) - Math.PI / 2;
    node.x = 0.5 + Math.cos(angle) * ring;
    node.y = 0.52 + Math.sin(angle) * ring * 0.72;
}

function drawGraph(
    context: CanvasRenderingContext2D,
    input: {
        graph: { edges: GraphEdge[]; nodes: GraphNode[] };
        height: number;
        selectedSlug: string | null;
        width: number;
    }
): HitCircle[] {
    const { graph, height, selectedSlug, width } = input;
    context.clearRect(0, 0, width, height);
    drawGrid(context, width, height);

    if (graph.nodes.length === 0) {
        drawEmptyGraph(context, width, height);
        return [];
    }

    const bounds = {
        bottom: height - 90,
        left: 80,
        right: width - 80,
        top: 120,
    };
    const positioned = graph.nodes.map((node) => ({
        ...node,
        x: bounds.left + node.x * Math.max(1, bounds.right - bounds.left),
        y: bounds.top + node.y * Math.max(1, bounds.bottom - bounds.top),
    }));
    const nodesBySlug = new Map(positioned.map((node) => [node.slug, node]));

    context.lineCap = 'round';
    for (const edge of graph.edges) {
        const from = nodesBySlug.get(edge.from);
        const to = nodesBySlug.get(edge.to);
        if (!(from && to)) {
            continue;
        }
        const isSelected = selectedSlug === from.slug || selectedSlug === to.slug;
        drawEdge(context, from, to, isSelected);
    }

    const hits: HitCircle[] = [];
    for (const node of positioned) {
        const isSelected = selectedSlug === node.slug;
        const radius = node.isGhost ? 8 : isSelected ? 18 : 13;
        drawNode(context, node, radius, isSelected);
        hits.push({ radius: radius + 10, slug: node.slug, x: node.x, y: node.y });
    }

    return hits;
}

function drawGrid(context: CanvasRenderingContext2D, width: number, height: number) {
    context.save();
    context.globalAlpha = 0.22;
    context.strokeStyle = '#78716c';
    context.lineWidth = 0.5;
    for (let x = 0; x < width; x += 34) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
    }
    for (let y = 0; y < height; y += 34) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
    }
    context.restore();
}

function drawEmptyGraph(context: CanvasRenderingContext2D, width: number, height: number) {
    context.save();
    context.fillStyle = '#78716c';
    context.font = '500 15px ui-sans-serif, system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillText('No Cortex pages yet', width / 2, height / 2);
    context.restore();
}

function drawEdge(
    context: CanvasRenderingContext2D,
    from: GraphNode,
    to: GraphNode,
    isSelected: boolean
) {
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const bend = Math.min(80, Math.max(-80, (to.x - from.x) * 0.14));

    context.save();
    context.strokeStyle = isSelected ? '#0f766e' : '#a8a29e';
    context.globalAlpha = isSelected ? 0.88 : 0.42;
    context.lineWidth = isSelected ? 2.2 : 1.1;
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.quadraticCurveTo(midX, midY - bend, to.x, to.y);
    context.stroke();
    context.restore();
}

function drawNode(
    context: CanvasRenderingContext2D,
    node: GraphNode,
    radius: number,
    isSelected: boolean
) {
    const color = nodeColor(node.type);
    context.save();
    context.shadowBlur = isSelected ? 24 : 12;
    context.shadowColor = isSelected ? color : 'rgb(15 23 42 / 0.18)';
    context.fillStyle = node.isGhost ? 'rgba(120,113,108,0.28)' : color;
    context.strokeStyle = isSelected ? '#111827' : 'rgba(255,255,255,0.92)';
    context.lineWidth = isSelected ? 3 : 2;
    context.beginPath();
    context.arc(node.x, node.y, radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    context.shadowBlur = 0;
    context.fillStyle = node.isGhost ? '#57534e' : '#1c1917';
    context.font = `${isSelected ? 600 : 500} 12px ui-sans-serif, system-ui, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.fillText(truncateLabel(node.title), node.x, node.y + radius + 9);
    context.restore();
}

function nodeColor(type: string) {
    switch (type) {
        case 'agent':
            return '#2563eb';
        case 'decision':
            return '#c2410c';
        case 'fact':
            return '#0f766e';
        case 'person':
            return '#be123c';
        case 'project':
            return '#7c3aed';
        case 'task':
            return '#ca8a04';
        default:
            return '#64748b';
    }
}

function truncateLabel(value: string) {
    return value.length > 24 ? `${value.slice(0, 21)}...` : value;
}

function resolveSelectedPage(list: CortexListOutput, selectedSlug: string | null) {
    return list.pages.find((page) => page.slug === selectedSlug) ?? list.pages[0] ?? null;
}

function countLinks(list: CortexListOutput) {
    return list.pages.reduce((count, page) => count + page.links.length, 0);
}
