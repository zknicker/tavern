import { ArrowRight01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../../components/ui/icon.tsx';
import {
    readConsolidations,
    readDreamSummary,
    readObservations,
    readPrunings,
    readReport,
    readSignals,
    readSkillActions,
    readTransitions,
    type WorkerReportView,
} from './background-work-view-data.ts';

/** Kind-appropriate report body. Missing metadata fields simply don't render. */
export function WorkerReportContent({ job }: { job: WorkerReportView }) {
    const metadata = job.metadata;

    return (
        <div className="space-y-3">
            {job.kind === 'extraction' ? <ExtractionReport metadata={metadata} /> : null}
            {job.kind === 'dream' ? <DreamReport metadata={metadata} /> : null}
            {job.kind === 'skill_review' ? <SkillReviewReport metadata={metadata} /> : null}
            {job.kind === 'curation' ? <CurationReport metadata={metadata} /> : null}
            <FileChanges job={job} />
        </div>
    );
}

function ExtractionReport({ metadata }: { metadata: WorkerReportView['metadata'] }) {
    const observations = readObservations(metadata);
    const signals = readSignals(metadata);

    return (
        <>
            {observations ? (
                <Block label="Observations">
                    <p className="whitespace-pre-wrap text-sm">{observations}</p>
                </Block>
            ) : null}
            {signals.length > 0 ? (
                <Block label="Learning signals">
                    <List items={signals} />
                </Block>
            ) : null}
        </>
    );
}

function DreamReport({ metadata }: { metadata: WorkerReportView['metadata'] }) {
    const summary = readDreamSummary(metadata);
    if (!summary) {
        return null;
    }
    return (
        <Block label="Outcome">
            <p className="whitespace-pre-wrap text-sm">{summary}</p>
        </Block>
    );
}

function SkillReviewReport({ metadata }: { metadata: WorkerReportView['metadata'] }) {
    const signals = readSignals(metadata);
    const actions = readSkillActions(metadata);
    const report = readReport(metadata);

    return (
        <>
            {signals.length > 0 ? (
                <Block label="Signals reviewed">
                    <List items={signals} />
                </Block>
            ) : null}
            {actions.length > 0 ? (
                <Block label="Actions taken">
                    <ul className="space-y-1 text-sm">
                        {actions.map((action) => (
                            <li className="truncate" key={`${action.skillId}-${action.path}`}>
                                <span className="font-medium">{action.skillId}</span>
                                <span className="text-muted-foreground"> · {action.path}</span>
                            </li>
                        ))}
                    </ul>
                </Block>
            ) : null}
            {report?.text ? (
                <Block label="Report">
                    <p className="whitespace-pre-wrap text-sm">{report.text}</p>
                </Block>
            ) : null}
            <ToolErrors errors={report?.toolErrors ?? []} />
        </>
    );
}

function CurationReport({ metadata }: { metadata: WorkerReportView['metadata'] }) {
    const consolidations = readConsolidations(metadata);
    const prunings = readPrunings(metadata);
    const transitions = readTransitions(metadata);
    const report = readReport(metadata);

    return (
        <>
            {consolidations.length > 0 ? (
                <Block label="Consolidations">
                    <ul className="space-y-1.5 text-sm">
                        {consolidations.map((item) => (
                            <li key={`${item.from}-${item.into}`}>
                                <span className="flex min-w-0 items-center gap-1.5">
                                    <span className="truncate font-medium">{item.from}</span>
                                    <Icon
                                        className="size-3.5 shrink-0 text-muted-foreground"
                                        icon={ArrowRight01Icon}
                                    />
                                    <span className="truncate font-medium">{item.into}</span>
                                </span>
                                {item.reason ? (
                                    <span className="block text-meta text-muted-foreground">
                                        {item.reason}
                                    </span>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                </Block>
            ) : null}
            {prunings.length > 0 ? (
                <Block label="Prunings">
                    <ul className="space-y-1.5 text-sm">
                        {prunings.map((item) => (
                            <li key={item.name}>
                                <span className="block font-medium">{item.name}</span>
                                {item.reason ? (
                                    <span className="block text-meta text-muted-foreground">
                                        {item.reason}
                                    </span>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                </Block>
            ) : null}
            {transitions.length > 0 ? (
                <Block label="Lifecycle">
                    <ul className="space-y-1 text-sm">
                        {transitions.map((item) => (
                            <li className="flex min-w-0 items-center gap-1.5" key={item.skillId}>
                                <span className="truncate font-medium">{item.skillId}</span>
                                <span className="shrink-0 text-meta text-muted-foreground">
                                    {item.from ?? '—'} → {item.to ?? '—'}
                                </span>
                            </li>
                        ))}
                    </ul>
                </Block>
            ) : null}
            {report?.text ? (
                <Block label="Report">
                    <p className="whitespace-pre-wrap text-sm">{report.text}</p>
                </Block>
            ) : null}
        </>
    );
}

function FileChanges({ job }: { job: WorkerReportView }) {
    if (job.fileChanges.length === 0) {
        return null;
    }
    return (
        <Block label="Files changed">
            <ul className="space-y-1 text-sm">
                {job.fileChanges.map((change) => (
                    <li className="truncate" key={`${change.path}-${change.afterHash}`}>
                        {change.beforeHash === null ? 'Created' : 'Updated'} {change.path}
                    </li>
                ))}
            </ul>
        </Block>
    );
}

function ToolErrors({ errors }: { errors: Array<{ error: string; tool: string }> }) {
    if (errors.length === 0) {
        return null;
    }
    return (
        <div className="rounded-md border border-error/30 bg-error-bg/70 px-3.5 py-3">
            <p className="mb-1.5 font-medium text-error-foreground text-meta">Tool errors</p>
            <ul className="space-y-1 text-error-foreground/85 text-sm">
                {errors.map((item) => (
                    <li key={`${item.tool}-${item.error}`}>
                        <span className="font-medium">{item.tool}:</span> {item.error}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function List({ items }: { items: string[] }) {
    return (
        <ul className="space-y-1 text-sm">
            {items.map((item) => (
                <li className="whitespace-pre-wrap" key={item}>
                    {item}
                </li>
            ))}
        </ul>
    );
}

function Block({ children, label }: { children: React.ReactNode; label: string }) {
    return (
        <div className="rounded-lg border border-border/70 px-3.5 py-3">
            <p className="mb-1.5 text-meta text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}
