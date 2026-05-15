import { type HTMLAttributes, useCallback, useEffect, useMemo, useRef } from 'react';
import { cn } from '../../lib/utils.ts';

interface FlickeringGridProps extends HTMLAttributes<HTMLDivElement> {
    colors?: string[];
    flickerChance?: number;
    gridGap?: number;
    height?: number;
    maxOpacity?: number;
    squareSize?: number;
    width?: number;
}

interface GridState {
    colorIndexes: Uint8Array;
    cols: number;
    dpr: number;
    opacities: Float32Array;
    rows: number;
}

function toRgbaPrefix(color: string) {
    if (typeof document === 'undefined') {
        return 'rgba(255, 255, 255,';
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;

    const context = canvas.getContext('2d');

    if (!context) {
        return 'rgba(255, 255, 255,';
    }

    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);

    const [red, green, blue] = Array.from(context.getImageData(0, 0, 1, 1).data);

    return `rgba(${red}, ${green}, ${blue},`;
}

export function FlickeringGrid({
    className,
    colors = ['#f59e0b', '#22c55e', '#38bdf8', '#e879f9'],
    flickerChance = 0.18,
    gridGap = 6,
    height,
    maxOpacity = 0.48,
    squareSize = 4,
    width,
    ...props
}: FlickeringGridProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const colorPrefixes = useMemo(() => colors.map(toRgbaPrefix), [colors]);

    const setupCanvas = useCallback(
        (canvas: HTMLCanvasElement, nextWidth: number, nextHeight: number): GridState => {
            const dpr = window.devicePixelRatio || 1;
            canvas.width = nextWidth * dpr;
            canvas.height = nextHeight * dpr;
            canvas.style.width = `${nextWidth}px`;
            canvas.style.height = `${nextHeight}px`;

            const cols = Math.ceil(nextWidth / (squareSize + gridGap));
            const rows = Math.ceil(nextHeight / (squareSize + gridGap));
            const total = cols * rows;
            const opacities = new Float32Array(total);
            const colorIndexes = new Uint8Array(total);

            for (let index = 0; index < total; index += 1) {
                opacities[index] = Math.random() * maxOpacity;
                colorIndexes[index] = Math.floor(Math.random() * colorPrefixes.length);
            }

            return { colorIndexes, cols, dpr, opacities, rows };
        },
        [colorPrefixes.length, gridGap, maxOpacity, squareSize]
    );

    const updateSquares = useCallback(
        (gridState: GridState, deltaTime: number) => {
            const refreshChance = flickerChance * deltaTime;

            for (let index = 0; index < gridState.opacities.length; index += 1) {
                if (Math.random() < refreshChance) {
                    gridState.opacities[index] = Math.random() * maxOpacity;
                }

                if (Math.random() < refreshChance * 0.72) {
                    gridState.colorIndexes[index] = Math.floor(
                        Math.random() * colorPrefixes.length
                    );
                }
            }
        },
        [colorPrefixes.length, flickerChance, maxOpacity]
    );

    const drawGrid = useCallback(
        (context: CanvasRenderingContext2D, gridState: GridState) => {
            const cellSize = squareSize + gridGap;

            context.clearRect(0, 0, context.canvas.width, context.canvas.height);

            for (let column = 0; column < gridState.cols; column += 1) {
                for (let row = 0; row < gridState.rows; row += 1) {
                    const index = column * gridState.rows + row;
                    const opacity = gridState.opacities[index];
                    const colorPrefix =
                        colorPrefixes[gridState.colorIndexes[index] % colorPrefixes.length];

                    context.fillStyle = `${colorPrefix}${opacity})`;
                    context.fillRect(
                        column * cellSize * gridState.dpr,
                        row * cellSize * gridState.dpr,
                        squareSize * gridState.dpr,
                        squareSize * gridState.dpr
                    );
                }
            }
        },
        [colorPrefixes, gridGap, squareSize]
    );

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        const context = canvas?.getContext('2d') ?? null;

        if (!(canvas && container && context)) {
            return;
        }

        let animationFrameId: number | null = null;
        let gridState: GridState | null = null;
        let resizeObserver: ResizeObserver | null = null;

        const updateCanvasSize = () => {
            const nextWidth = width ?? container.clientWidth;
            const nextHeight = height ?? container.clientHeight;
            gridState = setupCanvas(canvas, nextWidth, nextHeight);
            if (gridState) {
                drawGrid(context, gridState);
            }
        };

        updateCanvasSize();

        let lastTime = 0;

        const animate = (time: number) => {
            if (!gridState) {
                return;
            }

            const deltaTime = (time - lastTime) / 1000;
            lastTime = time;

            updateSquares(gridState, deltaTime);
            drawGrid(context, gridState);
            animationFrameId = window.requestAnimationFrame(animate);
        };

        resizeObserver = new ResizeObserver(() => {
            updateCanvasSize();
        });
        resizeObserver.observe(container);
        animationFrameId = window.requestAnimationFrame(animate);

        return () => {
            if (animationFrameId !== null) {
                window.cancelAnimationFrame(animationFrameId);
            }

            resizeObserver?.disconnect();
        };
    }, [drawGrid, height, setupCanvas, updateSquares, width]);

    return (
        <div className={cn('h-full w-full', className)} ref={containerRef} {...props}>
            <canvas className="pointer-events-none" ref={canvasRef} />
        </div>
    );
}
