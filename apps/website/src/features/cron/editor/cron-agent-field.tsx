import { useResolvedThemeOptional } from '../../../components/theme-provider.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import { Label } from '../../../components/ui/primitives/label.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../../components/ui/select.tsx';
import { resolveAgentInk } from '../../agents/agent-color-presets.ts';
import { AgentFace, type HeadName } from '../../chats/agent-face.tsx';

export interface CronAgentOption {
    character: HeadName;
    id: string;
    name: string;
    primaryColor: string | null;
}

interface CronAgentFieldProps {
    onValueChange: (value: string) => void;
    options: CronAgentOption[];
    value: string;
}

// Matches the sidebar avatar treatment: a 20px slot with a 24px face.
const faceStyle = { flexShrink: 0, height: 24, overflow: 'visible', width: 24 } as const;

export function CronAgentField({ onValueChange, options, value }: CronAgentFieldProps) {
    const dark = useResolvedThemeOptional() === 'dark';
    const selected = options.find((option) => option.id === value) ?? null;

    if (options.length === 0) {
        return (
            <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Agent</span>
                <Input
                    className="max-w-[12rem]"
                    disabled
                    placeholder="No agents synced"
                    size="sm"
                    value=""
                />
            </div>
        );
    }

    return (
        <div className="flex items-center justify-between gap-4 text-sm">
            <Label className="text-muted-foreground">Agent</Label>
            <Select
                onValueChange={(nextValue) => {
                    if (nextValue !== null) {
                        onValueChange(nextValue);
                    }
                }}
                value={value}
            >
                <SelectTrigger className="max-w-[12rem]" size="sm">
                    <SelectValue placeholder="Select an agent">
                        {selected ? <AgentOptionLabel agent={selected} dark={dark} /> : null}
                    </SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {options.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                            <AgentOptionLabel agent={option} dark={dark} />
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

function AgentOptionLabel({ agent, dark }: { agent: CronAgentOption; dark: boolean }) {
    return (
        <span className="flex min-w-0 items-center gap-1.5">
            <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center">
                <AgentFace
                    animate={false}
                    dark={dark}
                    head={agent.character}
                    ink={resolveAgentInk(dark, agent.primaryColor)}
                    size={24}
                    style={faceStyle}
                />
            </span>
            <span className="truncate">{agent.name}</span>
        </span>
    );
}
