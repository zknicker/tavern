import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { useState } from 'react';
import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { Card, CardFrame } from '../../../components/ui/card.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../../components/ui/select.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import { SettingsRow } from '../../../components/ui/settings-row.tsx';

export type ApprovalModeValue = 'allow' | 'ask' | 'deny';

const approvalModeOptions: {
    description: string;
    label: string;
    value: ApprovalModeValue;
}[] = [
    { description: 'Pause and wait for your answer.', label: 'Ask first', value: 'ask' },
    { description: 'Run without asking.', label: 'Always allow', value: 'allow' },
    { description: 'Block without asking.', label: 'Always deny', value: 'deny' },
];

export function AgentPermissionsSection({
    approvalMode,
    automationApprovalMode,
    commandAllowlist,
    disabled,
    onApprovalModeChange,
    onAutomationApprovalModeChange,
    onCommandAllowlistChange,
}: {
    approvalMode: ApprovalModeValue;
    automationApprovalMode: ApprovalModeValue;
    commandAllowlist: string[];
    disabled: boolean;
    onApprovalModeChange: (mode: ApprovalModeValue) => void;
    onAutomationApprovalModeChange: (mode: ApprovalModeValue) => void;
    onCommandAllowlistChange: (next: string[]) => void;
}) {
    return (
        <section>
            <BadgeDivider className="pb-4">Permissions</BadgeDivider>
            <CardFrame>
                <Card className="overflow-hidden p-0">
                    <SettingsRow
                        description="What happens when the agent wants to run something risky."
                        title="Tool approvals"
                    >
                        <ApprovalModeSelect
                            disabled={disabled}
                            onChange={onApprovalModeChange}
                            value={approvalMode}
                        />
                    </SettingsRow>

                    <Separator />

                    <SettingsRow
                        description="Approvals for scheduled runs, which cannot wait for an answer."
                        title="Automation approvals"
                    >
                        <ApprovalModeSelect
                            disabled={disabled}
                            onChange={onAutomationApprovalModeChange}
                            value={automationApprovalMode}
                        />
                    </SettingsRow>

                    <Separator />

                    <SettingsRow
                        description="Commands the agent may run without asking. Answering a prompt with Always adds a rule here."
                        title="Command allowlist"
                    >
                        <CommandAllowlistEditor
                            disabled={disabled}
                            onChange={onCommandAllowlistChange}
                            rules={commandAllowlist}
                        />
                    </SettingsRow>
                </Card>
            </CardFrame>
        </section>
    );
}

export function addAllowlistRule(list: string[], value: string): string[] {
    const trimmed = value.trim();

    if (!trimmed || list.includes(trimmed)) {
        return list;
    }

    return [...list, trimmed];
}

export function removeAllowlistRuleAt(list: string[], index: number): string[] {
    return list.filter((_, ruleIndex) => ruleIndex !== index);
}

function ApprovalModeSelect({
    disabled,
    onChange,
    value,
}: {
    disabled: boolean;
    onChange: (mode: ApprovalModeValue) => void;
    value: ApprovalModeValue;
}) {
    const selected = approvalModeOptions.find((option) => option.value === value) ?? null;

    return (
        <Select
            disabled={disabled}
            onValueChange={(nextValue) => {
                const option = approvalModeOptions.find((entry) => entry.value === nextValue);

                if (option) {
                    onChange(option.value);
                }
            }}
            value={value}
        >
            <SelectTrigger className="h-auto min-h-12 py-2">
                <SelectValue className="min-w-0 flex-1 whitespace-normal">
                    {selected ? (
                        <ApprovalModeLabel
                            description={selected.description}
                            label={selected.label}
                        />
                    ) : undefined}
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
                {approvalModeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                        <ApprovalModeLabel description={option.description} label={option.label} />
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

function ApprovalModeLabel({ description, label }: { description: string; label: string }) {
    return (
        <span className="block min-w-0">
            <span className="block truncate">{label}</span>
            <span className="block truncate text-muted-foreground text-xs">{description}</span>
        </span>
    );
}

function CommandAllowlistEditor({
    disabled,
    onChange,
    rules,
}: {
    disabled: boolean;
    onChange: (next: string[]) => void;
    rules: string[];
}) {
    const [draft, setDraft] = useState('');

    const commitDraft = () => {
        const next = addAllowlistRule(rules, draft);

        if (next !== rules) {
            onChange(next);
        }

        setDraft('');
    };

    return (
        <div className="flex flex-col gap-2">
            {rules.map((rule, index) => (
                <div
                    className="flex items-center gap-2 rounded-lg bg-muted py-1.5 ps-3 pe-1.5 dark:bg-input/32"
                    key={rule}
                >
                    <span className="block min-w-0 flex-1 truncate font-mono text-sm">{rule}</span>
                    <Button
                        aria-label="Remove allowlist rule"
                        disabled={disabled}
                        onClick={() => onChange(removeAllowlistRuleAt(rules, index))}
                        size="icon-sm"
                        variant="ghost"
                    >
                        <Icon icon={Cancel01Icon} />
                    </Button>
                </div>
            ))}

            <Input
                disabled={disabled}
                onBlur={commitDraft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        commitDraft();
                    }
                }}
                placeholder="Add a command rule"
                value={draft}
            />
        </div>
    );
}
