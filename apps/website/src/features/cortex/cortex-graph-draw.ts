import type { CortexPageNode } from './types.ts';

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

export interface HitCircle {
    radius: number;
    slug: string;
    x: number;
    y: number;
}

export function buildGraph(pages: CortexPageNode[]) {
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

export function drawGraph(
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
        bottom: height - 36,
        left: 42,
        right: width - 42,
        top: 36,
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
        const radius = node.isGhost ? 7 : isSelected ? 15 : 11;
        drawNode(context, node, radius, isSelected);
        hits.push({ radius: radius + 10, slug: node.slug, x: node.x, y: node.y });
    }

    return hits;
}

function assignSeedPosition(node: GraphNode, index: number, total: number) {
    const ring = index % 2 === 0 ? 0.36 : 0.48;
    const angle = (Math.PI * 2 * index) / Math.max(total, 1) - Math.PI / 2;
    node.x = 0.5 + Math.cos(angle) * ring;
    node.y = 0.52 + Math.sin(angle) * ring * 0.72;
}

function drawGrid(context: CanvasRenderingContext2D, width: number, height: number) {
    context.save();
    context.globalAlpha = 0.16;
    context.strokeStyle = '#78716c';
    context.lineWidth = 0.5;
    for (let x = 0; x < width; x += 28) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
    }
    for (let y = 0; y < height; y += 28) {
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
    context.font = '500 13px ui-sans-serif, system-ui, sans-serif';
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
    const bend = Math.min(44, Math.max(-44, (to.x - from.x) * 0.14));

    context.save();
    context.strokeStyle = isSelected ? '#0f766e' : '#a8a29e';
    context.globalAlpha = isSelected ? 0.88 : 0.42;
    context.lineWidth = isSelected ? 2 : 1;
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
    context.shadowBlur = isSelected ? 14 : 8;
    context.shadowColor = isSelected ? color : 'rgb(15 23 42 / 0.16)';
    context.fillStyle = node.isGhost ? 'rgba(120,113,108,0.28)' : color;
    context.strokeStyle = isSelected ? '#111827' : 'rgba(255,255,255,0.92)';
    context.lineWidth = isSelected ? 2.5 : 1.5;
    context.beginPath();
    context.arc(node.x, node.y, radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    context.shadowBlur = 0;
    context.fillStyle = node.isGhost ? '#57534e' : '#1c1917';
    context.font = `${isSelected ? 600 : 500} 11px ui-sans-serif, system-ui, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.fillText(truncateLabel(node.title), node.x, node.y + radius + 7);
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
