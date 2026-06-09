import { AiAudioIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Field, FieldDescription, FieldError } from '../../components/ui/primitives/field.tsx';
import { Form } from '../../components/ui/primitives/form.tsx';
import { Input } from '../../components/ui/primitives/input.tsx';
import { useSaveOpenRouterSettings } from '../../hooks/connections/use-save-openrouter-settings.ts';
import type { LiveUsageOutput } from '../../lib/trpc.tsx';
import { UsageSpendSummary } from './usage-spend-summary.tsx';
import { UsageSpendTooltip } from './usage-spend-tooltip.tsx';
import { useUsageSpend } from './use-usage-spend.ts';

interface UsageSpendModuleProps {
    liveUsage: LiveUsageOutput | undefined;
}

const keyColors = [
    '#f97316',
    '#38bdf8',
    '#a78bfa',
    '#34d399',
    '#fb7185',
    '#facc15',
    '#06b6d4',
    '#f472b6',
];

export function UsageSpendModule({ liveUsage }: UsageSpendModuleProps) {
    const { chartData, emptyChartMessage, grandTotal, hasChart, keyStats, keys } =
        useUsageSpend(liveUsage);
    const needsManagementKey =
        liveUsage?.openRouter.overview.status === 'unconfigured' ||
        liveUsage?.openRouter.error?.code === 'auth';

    if (!hasChart) {
        return (
            <Card>
                <CardHeader className="p-4 pb-0">
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Icon icon={AiAudioIcon} size={20} />
                        OpenRouter
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    <div className="flex h-52 items-center justify-center">
                        {needsManagementKey ? (
                            <OpenRouterManagementKeyForm />
                        ) : (
                            <p className="text-muted-foreground text-sm">{emptyChartMessage}</p>
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="overflow-hidden">
            <CardHeader className="p-4 pb-0">
                <CardTitle className="flex items-center gap-2 text-sm">
                    <Icon icon={AiAudioIcon} size={20} />
                    OpenRouter
                </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pt-3 pb-0">
                <div className="h-48">
                    <ResponsiveContainer height="100%" width="100%">
                        <BarChart
                            data={chartData}
                            margin={{ bottom: 0, left: -20, right: 4, top: 4 }}
                        >
                            <XAxis
                                axisLine={false}
                                dataKey="day"
                                interval="preserveStartEnd"
                                minTickGap={24}
                                tick={{
                                    fill: 'var(--color-muted-foreground)',
                                    fontSize: 'var(--text-caption)',
                                }}
                                tickLine={false}
                            />
                            <YAxis
                                allowDecimals={false}
                                axisLine={false}
                                tick={{
                                    fill: 'var(--color-muted-foreground)',
                                    fontSize: 'var(--text-caption)',
                                }}
                                tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
                                tickLine={false}
                                width={40}
                            />
                            <Tooltip
                                content={<UsageSpendTooltip />}
                                cursor={{ fill: 'var(--color-muted)', opacity: 0.4, radius: 4 }}
                            />
                            {keys.map((key, index) => (
                                <Bar
                                    dataKey={key.id}
                                    fill={keyColors[index % keyColors.length]}
                                    key={key.id}
                                    name={key.label}
                                    radius={index === keys.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                                    stackId="spend"
                                />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
            <UsageSpendSummary grandTotal={grandTotal} stats={keyStats} />
        </Card>
    );
}

function OpenRouterManagementKeyForm() {
    const [managementApiKey, setManagementApiKey] = React.useState('');
    const saveSettings = useSaveOpenRouterSettings({
        onSuccess: () => setManagementApiKey(''),
    });

    const handleSubmit = React.useEffectEvent((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        saveSettings.mutate({
            apiKey: null,
            managementApiKey,
        });
    });

    return (
        <Form className="w-full max-w-md gap-3" onSubmit={handleSubmit}>
            <Field>
                <Input
                    aria-label="OpenRouter management key"
                    autoComplete="off"
                    onChange={(event) => setManagementApiKey(event.currentTarget.value)}
                    placeholder="OpenRouter management key"
                    type="password"
                    value={managementApiKey}
                />
                <FieldDescription>
                    Add a management key to sync OpenRouter account activity.
                </FieldDescription>
                {saveSettings.error ? <FieldError>{saveSettings.error.message}</FieldError> : null}
            </Field>
            <div className="flex justify-end">
                <Button
                    disabled={!managementApiKey.trim()}
                    loading={saveSettings.isPending}
                    size="sm"
                    type="submit"
                    variant="secondary"
                >
                    Save key
                </Button>
            </div>
        </Form>
    );
}

function formatDay(date: string) {
    return new Intl.DateTimeFormat(undefined, {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
    }).format(new Date(`${date}T00:00:00.000Z`));
}

function _getOpenRouterRangeLabel(latestReportedDate: string | null) {
    if (!latestReportedDate) {
        return 'Last 30 UTC days';
    }

    return `Through ${formatDay(latestReportedDate)} UTC`;
}
