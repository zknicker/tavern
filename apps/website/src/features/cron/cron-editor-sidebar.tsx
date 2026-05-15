import { useStore } from '@tanstack/react-form';
import type { ReactNode } from 'react';
import { Label } from '../../components/ui/primitives/label.tsx';
import { ScrollArea } from '../../components/ui/scroll-area.tsx';
import { Separator } from '../../components/ui/separator.tsx';
import { Switch } from '../../components/ui/switch.tsx';
import { usePrimaryAgent } from '../../hooks/agents/use-agent-list.ts';
import { formatTimestamp } from '../../lib/format.ts';
import type { CronGetOutput } from '../../lib/trpc.tsx';
import { CronEditorScheduleFields } from './cron-editor-schedule-fields.tsx';
import type { CronFormState } from './cron-form.ts';
import { CronDeliveryFields } from './editor/cron-delivery-fields.tsx';
import { CronSectionHeader } from './editor/cron-section.tsx';
import { CronSelectRow } from './editor/cron-select-field.tsx';
import { useCronEditorOptions } from './editor/use-cron-editor-options.ts';
import type { CronEditorFormApi } from './use-cron-editor-form.ts';

type CronJob = CronGetOutput['job'];

const runTypeOptions = [
    { label: 'Agent turn', value: 'agentTurn' as const },
    { label: 'System event', value: 'systemEvent' as const },
];

interface CronEditorSidebarProps {
    form: CronEditorFormApi;
    job: CronJob | null;
}

function SidebarSection({ children, title }: { children: ReactNode; title: string }) {
    return (
        <section className="space-y-2">
            <CronSectionHeader title={title} />
            {children}
        </section>
    );
}

function SidebarValueRow({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="min-w-0 truncate text-foreground">{value}</span>
        </div>
    );
}

function formatStateTime(value: number | undefined) {
    return value ? formatTimestamp(new Date(value).toISOString()) : 'Not available';
}

export function CronEditorSidebar({ form, job }: CronEditorSidebarProps) {
    const currentAgentId = useStore(form.store, (state) => state.values.agentId);
    const currentDeliveryChatId = useStore(form.store, (state) => state.values.deliveryChatId);
    const isSystemEvent = useStore(form.store, (state) => state.values.runType === 'systemEvent');
    const primaryAgentQuery = usePrimaryAgent();
    const { deliveryChatOptions } = useCronEditorOptions({ currentDeliveryChatId });
    const agentLabel =
        primaryAgentQuery.data?.agent?.name ?? (currentAgentId.trim() || 'No synced agent');

    return (
        <aside className="w-full border-border/70 border-t lg:w-[22rem] lg:border-t-0 lg:border-l">
            <ScrollArea scrollbarGutter>
                <div className="flex flex-col gap-4 px-4 pt-7 pb-4">
                    <SidebarSection title="Status">
                        <div className="grid gap-2">
                            <form.Field name="enabled">
                                {(field) => (
                                    <Label className="cursor-pointer justify-between gap-4 text-sm">
                                        <span className="text-muted-foreground">Enabled</span>
                                        <Switch
                                            checked={field.state.value}
                                            onCheckedChange={(checked) =>
                                                field.handleChange(checked)
                                            }
                                        />
                                    </Label>
                                )}
                            </form.Field>
                            {job ? (
                                <>
                                    <SidebarValueRow
                                        label="Next run"
                                        value={formatStateTime(job.state.nextRunAtMs)}
                                    />
                                    <SidebarValueRow
                                        label="Last ran"
                                        value={formatStateTime(job.state.lastRunAtMs)}
                                    />
                                </>
                            ) : null}
                        </div>
                    </SidebarSection>

                    <Separator />

                    <SidebarSection title="Schedule">
                        <CronEditorScheduleFields form={form} />
                    </SidebarSection>

                    <Separator />

                    <SidebarSection title="Delivery">
                        <form.Field name="runType">
                            {(field) => (
                                <CronSelectRow
                                    label="Run type"
                                    onValueChange={(value) =>
                                        field.handleChange(value as CronFormState['runType'])
                                    }
                                    options={runTypeOptions}
                                    value={field.state.value}
                                />
                            )}
                        </form.Field>
                        {isSystemEvent ? null : (
                            <SidebarValueRow label="Agent" value={agentLabel} />
                        )}
                        <CronDeliveryFields deliveryChatOptions={deliveryChatOptions} form={form} />
                    </SidebarSection>
                </div>
            </ScrollArea>
        </aside>
    );
}
