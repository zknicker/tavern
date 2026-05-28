import * as React from 'react';
import { cn } from '../../lib/utils.ts';
import { buildGraph, drawGraph, type HitCircle } from './cortex-graph-draw.ts';
import type { CortexPageNode } from './types.ts';

export function CortexGraphCanvas({
    className,
    onSelect,
    pages,
    selectedSlug,
}: {
    className?: string;
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

        const hit = findHitCircle(canvas, event, hitCirclesRef.current);
        canvas.style.cursor = hit ? 'pointer' : 'default';
    }, []);

    const handleClick = React.useCallback(
        (event: React.PointerEvent<HTMLCanvasElement>) => {
            const canvas = canvasRef.current;
            if (!canvas) {
                return;
            }

            const hit = findHitCircle(canvas, event, hitCirclesRef.current);
            if (hit) {
                onSelect(hit.slug);
            }
        },
        [onSelect]
    );

    return (
        <div
            className={cn(
                'relative overflow-hidden bg-[linear-gradient(135deg,rgb(250_250_249),rgb(245_245_244))] dark:bg-[linear-gradient(135deg,rgb(12_12_10),rgb(28_25_23))]',
                className
            )}
        >
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

function findHitCircle(
    canvas: HTMLCanvasElement,
    event: React.PointerEvent<HTMLCanvasElement>,
    hitCircles: HitCircle[]
) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return hitCircles.find((circle) => {
        const distance = Math.hypot(circle.x - x, circle.y - y);
        return distance <= circle.radius;
    });
}
