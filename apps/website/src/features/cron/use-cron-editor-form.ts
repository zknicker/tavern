import { useForm } from '@tanstack/react-form';
import * as React from 'react';
import type { CronGetOutput } from '../../lib/trpc.tsx';
import { type CronFormState, createCronFormState } from './cron-form.ts';

type CronJob = CronGetOutput['job'];

interface UseCronEditorFormOptions {
    job: CronJob | null;
    onSubmit: (state: CronFormState) => Promise<void>;
    primaryAgentId?: string;
    template?: Partial<CronFormState>;
}

interface CronEditorFormLike {
    setErrorMap: (errorMap: Record<string, unknown>) => void;
    state: {
        errorMap: Record<string, unknown> & {
            onSubmit?: unknown;
        };
    };
}

function clearSubmitError(form: CronEditorFormLike) {
    if (form.state.errorMap.onSubmit === undefined) {
        return;
    }

    form.setErrorMap({
        ...form.state.errorMap,
        onSubmit: undefined,
    });
}

export function getCronEditorErrorMessage(error: unknown) {
    if (typeof error === 'string') {
        const message = error.trim();

        if (message) {
            return message;
        }
    }

    if (error instanceof Error) {
        const message = error.message.trim();

        if (message) {
            return message;
        }
    }

    if (
        error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof error.message === 'string'
    ) {
        const message = error.message.trim();

        if (message) {
            return message;
        }
    }

    return 'Unable to save automation.';
}

export function getCronEditorSubmitErrorMessage(error: unknown) {
    if (typeof error === 'string') {
        const message = error.trim();
        return message ? message : null;
    }

    if (error && typeof error === 'object' && 'form' in error && typeof error.form === 'string') {
        const message = error.form.trim();
        return message ? message : null;
    }

    return null;
}

export function getCronEditorFormKey(job: CronJob | null, primaryAgentId = '', templateId = '') {
    if (job === null) {
        return `create:${primaryAgentId}:${templateId}`;
    }

    return JSON.stringify(createCronFormState(job, primaryAgentId));
}

export function useCronEditorForm({
    job,
    onSubmit,
    primaryAgentId = '',
    template,
}: UseCronEditorFormOptions) {
    const handleSubmit = React.useEffectEvent(onSubmit);

    return useForm({
        defaultValues: createCronFormState(job, primaryAgentId, template),
        onSubmit: async ({ formApi, value }) => {
            clearSubmitError(formApi);

            try {
                await handleSubmit(value);
            } catch (error) {
                formApi.setErrorMap({
                    ...formApi.state.errorMap,
                    onSubmit: {
                        fields: {},
                        form: getCronEditorErrorMessage(error),
                    },
                });
            }
        },
    });
}

export type CronEditorFormApi = ReturnType<typeof useCronEditorForm>;
