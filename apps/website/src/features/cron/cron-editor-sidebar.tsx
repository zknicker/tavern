import { useStore } from '@tanstack/react-form';
import { type ReactNode, useEffect, useMemo, useRef } from 'react';
import { Label } from '../../components/ui/primitives/label.tsx';
import { ScrollArea } from '../../components/ui/scroll-area.tsx';
import { Separator } from '../../components/ui/separator.tsx';
import { Switch } from '../../components/ui/switch.tsx';
import { useAgentList } from '../../hooks/agents/use-agent-list.ts';
import { formatTimestamp } from '../../lib/format.ts';
import type { CronGetOutput, CronRunsOutput } from '../../lib/trpc.tsx';
import { CronEditorScheduleFields } from './cron-editor-schedule-fields.tsx';
import type { CronFormState } from './cron-form.ts';
import { CronRunHistoryList } from './cron-run-history-list.tsx';
import { CronAgentField } from './editor/cron-agent-field.tsx';
import { CronDeliveryFields } from './editor/cron-delivery-fields.tsx';
import { CronSectionHeader } from './editor/cron-section.tsx';
import { CronSelectRow } from './editor/cron-select-field.tsx';
import { useCronEditorOptions } from './editor/use-cron-editor-options.ts';
import type { CronEditorFormApi } from './use-cron-editor-form.ts';

type CronJob = CronGetOutput['job'];

const runTypeOptions = [
    { label: 'Agent turn', value: 'agentTurn' as const },
    { label: 'Script', value: 'script' as const },
    { label: 'System event', value: 'systemEvent' as const },
];

interface CronEditorSidebarProps {
    actions: ReactNode;
    form: CronEditorFormApi;
    isRunsPending: boolean;
    job: CronJob | null;
    onRunSelect: (run: CronRunsOutput['runs'][number]) => void;
    runs: CronRunsOutput['runs'];
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

export function CronEditorSidebar({
    actions,
    form,
    isRunsPending,
    job,
    onRunSelect,
    runs,
}: CronEditorSidebarProps) {
    const agentId = useStore(form.store, (state) => state.values.agentId);
    const currentDeliveryChatId = useStore(form.store, (state) => state.values.deliveryChatId);
    const { deliveryChatOptions } = useCronEditorOptions({ agentId, currentDeliveryChatId });
    const agentsQuery = useAgentList();
    const agentOptions = useMemo(
        () =>
            (agentsQuery.data?.agents ?? []).map((agent) => ({
                character: agent.effectiveCharacter,
                id: agent.id,
                name: agent.name,
                primaryColor: agent.effectivePrimaryColor,
            })),
        [agentsQuery.data?.agents]
    );
    const previousAgentIdRef = useRef(agentId);

    useEffect(() => {
        if (previousAgentIdRef.current === agentId) {
            return;
        }

        previousAgentIdRef.current = agentId;
        form.setFieldValue('deliveryChatId', '');
    }, [agentId, form]);

    return (
        <aside className="relative flex min-h-0 w-full flex-col border-border/70 border-t max-lg:max-h-[45dvh] max-lg:flex-none lg:w-[22rem] lg:border-t-0 lg:border-l-0 lg:before:absolute lg:before:inset-y-0 lg:before:left-0 lg:before:w-px lg:before:bg-gradient-to-t lg:before:from-border/70 lg:before:via-60% lg:before:via-border/70 lg:before:to-transparent lg:before:content-['']">
            <ScrollArea scrollbarGutter>
                <div className="flex flex-col gap-4 px-4 pt-4 pb-4">
                    <div className="max-lg:hidden">{actions}</div>
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
                        <form.Field name="agentId">
                            {(field) => (
                                <CronAgentField
                                    onValueChange={field.handleChange}
                                    options={agentOptions}
                                    value={field.state.value}
                                />
                            )}
                        </form.Field>
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
                        <CronDeliveryFields
                            agentId={agentId}
                            deliveryChatOptions={deliveryChatOptions}
                            form={form}
                        />
                    </SidebarSection>

                    {job ? (
                        <>
                            <Separator />

                            <SidebarSection title="History">
                                <CronRunHistoryList
                                    isPending={isRunsPending}
                                    onRunSelect={onRunSelect}
                                    runs={runs}
                                />
                            </SidebarSection>
                        </>
                    ) : null}
                </div>
            </ScrollArea>
        </aside>
    );
}
