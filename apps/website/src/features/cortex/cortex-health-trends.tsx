import {
    EvilLineChart,
    Grid,
    Line,
    Tooltip,
    XAxis,
    YAxis,
} from '../../components/charts/line-chart.tsx';
import type { ChartConfig } from '../../components/charts/ui/chart.tsx';
import type { CortexHealthOutput } from '../../lib/trpc.tsx';

type HistoryEntry = NonNullable<CortexHealthOutput>['history'][number];

const scoresConfig = {
    quality: {
        colors: { dark: ['#10b981'], light: ['#047857'] },
        label: 'Quality',
    },
    staleness: {
        colors: { dark: ['#a78bfa'], light: ['#7658b8'] },
        label: 'Staleness',
    },
} satisfies ChartConfig;

const escalationsConfig = {
    escalations: {
        colors: { dark: ['#fbbf24'], light: ['#b45309'] },
        label: 'Open escalations',
    },
} satisfies ChartConfig;

export function CortexHealthTrends({ history }: { history: HistoryEntry[] }) {
    const data = buildTrendData(history);
    if (data.length < 2) {
        return null;
    }

    return (
        <div className="mt-4 grid grid-cols-1 gap-2 lg:grid-cols-2">
            <div className="rounded-lg bg-muted/40 px-3 pt-2.5 pb-1">
                <p className="text-muted-foreground text-sm">Staleness & quality</p>
                <EvilLineChart
                    className="mt-1 h-36 w-full"
                    config={scoresConfig}
                    data={data}
                    xDataKey="day"
                >
                    <Grid />
                    <XAxis dataKey="day" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Line
                        curveType="monotone"
                        dataKey="staleness"
                        glowing
                        lineProps={{ dot: false }}
                    />
                    <Line
                        curveType="monotone"
                        dataKey="quality"
                        glowing
                        lineProps={{ dot: false }}
                    />
                </EvilLineChart>
            </div>
            <div className="rounded-lg bg-muted/40 px-3 pt-2.5 pb-1">
                <p className="text-muted-foreground text-sm">Open escalations</p>
                <EvilLineChart
                    className="mt-1 h-36 w-full"
                    config={escalationsConfig}
                    data={data}
                    xDataKey="day"
                >
                    <Grid />
                    <XAxis dataKey="day" />
                    <YAxis allowDecimals={false} domain={[0, 'auto']} />
                    <Tooltip />
                    <Line curveType="stepAfter" dataKey="escalations" lineProps={{ dot: false }} />
                </EvilLineChart>
            </div>
        </div>
    );
}

/**
 * One point per day: the last sample per topic that day, scores averaged
 * across topics, escalations summed.
 */
function buildTrendData(history: HistoryEntry[]) {
    const byDay = new Map<string, Map<string, HistoryEntry>>();
    for (const entry of history) {
        const day = entry.recordedAt.slice(0, 10);
        const topics = byDay.get(day) ?? new Map<string, HistoryEntry>();
        topics.set(entry.topic, entry);
        byDay.set(day, topics);
    }

    return [...byDay.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([day, topics]) => {
            const entries = [...topics.values()];
            const staleness = entries
                .map((entry) => entry.avgStaleness)
                .filter((value): value is number => value !== null);
            const quality = entries
                .map((entry) => entry.avgQuality)
                .filter((value): value is number => value !== null);
            return {
                day: formatDay(day),
                escalations: entries.reduce((sum, entry) => sum + entry.escalationsOpen, 0),
                quality: average(quality),
                staleness: average(staleness),
            };
        });
}

function average(values: number[]) {
    if (values.length === 0) {
        return null;
    }
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function formatDay(day: string) {
    return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
    });
}
