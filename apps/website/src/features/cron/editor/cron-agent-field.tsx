import { Input } from '../../../components/ui/primitives/input.tsx';
import { Label } from '../../../components/ui/primitives/label.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../../components/ui/select.tsx';
import { AgentOptionLabel, type AgentSelectOption } from '../../agents/agent-option-label.tsx';

interface CronAgentFieldProps {
    onValueChange: (value: string) => void;
    options: AgentSelectOption[];
    value: string;
}

export function CronAgentField({ onValueChange, options, value }: CronAgentFieldProps) {
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
                        {selected ? <AgentOptionLabel agent={selected} /> : null}
                    </SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {options.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                            <AgentOptionLabel agent={option} />
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
