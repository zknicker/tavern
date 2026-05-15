import type { ZodType } from 'zod';

export interface JobFailureRecord {
    cause: string | null;
    message: string;
}

export interface JobExecutionState {
    failure: JobFailureRecord | null;
}

export interface JobRunContext<TInput extends Record<string, unknown>> {
    fail: (message: string, cause?: unknown) => Promise<void>;
    input: TInput;
    log: (message: string) => Promise<void>;
}

export interface ManualJobSchedule {
    kind: 'manual';
}

export interface IntervalJobSchedule {
    everyMs: number;
    kind: 'interval';
    runOnStart: boolean;
}

export type JobSchedule = IntervalJobSchedule | ManualJobSchedule;

export interface JobDefinition<TInput extends Record<string, unknown>> {
    concurrency: number;
    defaultInput: TInput;
    description: string;
    displayName: string;
    isEnabled: () => Promise<boolean>;
    payloadSchema: ZodType<TInput>;
    run: (context: JobRunContext<TInput>) => Promise<void>;
    schedule: JobSchedule;
    slug: string;
}

type JobEnabledResolver = () => boolean | Promise<boolean>;

const emptyObjectSchema = {
    parse(input: unknown) {
        if (input === undefined) {
            return {};
        }

        if (input && typeof input === 'object' && !Array.isArray(input)) {
            return input as Record<string, unknown>;
        }

        throw new Error('Job input must be an object.');
    },
} as ZodType<Record<string, unknown>>;

function titleCase(value: string) {
    return value
        .split(/[\s_-]+/u)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

export class JobBuilder<TInput extends Record<string, unknown>> {
    private concurrencyValue = 1;
    private defaultInputValue: TInput;
    private descriptionValue: string;
    private displayNameValue: string;
    private enabledResolver: JobEnabledResolver = () => true;
    private payloadSchemaValue: ZodType<TInput>;
    private scheduleValue: JobSchedule = {
        kind: 'manual',
    };

    constructor(private readonly slug: string) {
        const label = titleCase(slug);
        this.defaultInputValue = {} as TInput;
        this.descriptionValue = label;
        this.displayNameValue = label;
        this.payloadSchemaValue = emptyObjectSchema as ZodType<TInput>;
    }

    concurrency(value: number) {
        this.concurrencyValue = value;
        return this;
    }

    defaultInput(input: TInput) {
        this.defaultInputValue = input;
        return this;
    }

    description(value: string) {
        this.descriptionValue = value;
        return this;
    }

    displayName(value: string) {
        this.displayNameValue = value;
        return this;
    }

    enabledWhen(resolver: JobEnabledResolver) {
        this.enabledResolver = resolver;
        return this;
    }

    input<TNextInput extends Record<string, unknown>>(schema: ZodType<TNextInput>) {
        const nextBuilder = this as unknown as JobBuilder<TNextInput>;
        nextBuilder.payloadSchemaValue = schema;
        nextBuilder.defaultInputValue = {} as TNextInput;
        return nextBuilder;
    }

    interval(input: { everyMs: number; runOnStart?: boolean }) {
        this.scheduleValue = {
            everyMs: input.everyMs,
            kind: 'interval',
            runOnStart: input.runOnStart ?? false,
        };
        return this;
    }

    manual() {
        this.scheduleValue = {
            kind: 'manual',
        };
        return this;
    }

    work(run: (context: JobRunContext<TInput>) => Promise<void>): JobDefinition<TInput> {
        return {
            concurrency: this.concurrencyValue,
            defaultInput: this.defaultInputValue,
            description: this.descriptionValue,
            displayName: this.displayNameValue,
            isEnabled: async () => Boolean(await this.enabledResolver()),
            payloadSchema: this.payloadSchemaValue,
            run,
            schedule: this.scheduleValue,
            slug: this.slug,
        };
    }
}

export function defineJob(slug: string) {
    return new JobBuilder<Record<string, unknown>>(slug);
}
