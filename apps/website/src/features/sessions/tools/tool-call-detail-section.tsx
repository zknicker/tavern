import JsonView from '@uiw/react-json-view';
import { formatDetailValue, parseJsonValue } from './tool-detail-value.ts';
import { toolJsonViewStyle } from './tool-json-view-style.ts';

export function ToolCallDetailSection({
    collapsed = 2,
    title,
    value,
}: {
    collapsed?: boolean | number;
    title: string;
    value: unknown;
}) {
    const content = formatDetailValue(value);

    if (!content) {
        return null;
    }

    const jsonValue = parseJsonValue(value);

    return (
        <div>
            <p className="mb-2 font-medium text-caption text-muted-foreground uppercase tracking-[0.14em]">
                {title}
            </p>
            {jsonValue ? (
                <div className="overflow-auto rounded-lg border border-border/40 bg-background/60 px-3.5 py-3">
                    <JsonView
                        collapsed={collapsed}
                        displayDataTypes={false}
                        displayObjectSize={false}
                        enableClipboard={false}
                        style={toolJsonViewStyle}
                        value={jsonValue}
                    />
                </div>
            ) : (
                <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-border/40 bg-background/60 px-3.5 py-3 font-mono text-foreground text-sm leading-relaxed">
                    {content}
                </pre>
            )}
        </div>
    );
}

export function ToolCallMetaRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline justify-between gap-4">
            <span className="shrink-0 text-muted-foreground text-sm">{label}</span>
            <span className="min-w-0 truncate text-right font-mono text-foreground text-sm tabular-nums">
                {value}
            </span>
        </div>
    );
}
