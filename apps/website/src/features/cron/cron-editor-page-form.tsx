import * as React from 'react';
import { usePrimaryAgentSuspense } from '../../hooks/agents/use-agent-list.ts';
import type { CronGetOutput } from '../../lib/trpc.tsx';
import { CronEditorPromptPane } from './cron-editor-prompt-pane.tsx';
import { CronEditorSidebar } from './cron-editor-sidebar.tsx';
import type { CronFormState } from './cron-form.ts';
import {
    getCronEditorFormKey,
    getCronEditorSubmitErrorMessage,
    useCronEditorForm,
} from './use-cron-editor-form.ts';

type CronJob = CronGetOutput['job'];

interface CronEditorPageFormProps {
    job: CronJob | null;
    onSubmit: (formState: CronFormState) => Promise<void>;
}

function CronEditorPageFormInner({
    job,
    onSubmit,
    primaryAgentId,
}: CronEditorPageFormProps & { primaryAgentId: string }) {
    const form = useCronEditorForm({
        job,
        onSubmit,
        primaryAgentId,
    });

    const handleSubmit = React.useEffectEvent((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        void form.handleSubmit();
    });

    return (
        <form
            className="flex min-h-0 flex-1 flex-col lg:flex-row"
            id="cron-editor-form"
            onSubmit={handleSubmit}
        >
            <form.Subscribe
                selector={(state) => ({
                    errorMessage: getCronEditorSubmitErrorMessage(state.errorMap.onSubmit),
                })}
            >
                {({ errorMessage }) => (
                    <>
                        <CronEditorPromptPane errorMessage={errorMessage} form={form} />
                        <CronEditorSidebar form={form} job={job} />
                    </>
                )}
            </form.Subscribe>
        </form>
    );
}

export function CronEditorPageForm(props: CronEditorPageFormProps) {
    const [primaryAgent] = usePrimaryAgentSuspense();

    return (
        <CronEditorPageFormInner
            key={getCronEditorFormKey(props.job, primaryAgent.agent?.id ?? '')}
            primaryAgentId={primaryAgent.agent?.id ?? ''}
            {...props}
        />
    );
}
