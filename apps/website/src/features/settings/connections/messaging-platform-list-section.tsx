import { Plus, Trash2 } from '@hugeicons/core-free-icons';
import * as React from 'react';
import { Badge } from '../../../components/ui/badge.tsx';
import { Card, CardFrame } from '../../../components/ui/card.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import {
    SettingsActionRow,
    SettingsItem,
    SettingsRow,
} from '../../../components/ui/settings-row.tsx';

export function MessagingPlatformListSection({
    addLabel,
    disabled,
    emptyLabel,
    itemLabel,
    onValuesChange,
    placeholder,
    title,
    values,
}: {
    addLabel: string;
    disabled: boolean;
    emptyLabel: string;
    itemLabel: string;
    onValuesChange: (values: string[]) => void;
    placeholder: string;
    title: string;
    values: string[];
}) {
    const [isAdding, setIsAdding] = React.useState(false);
    const [draft, setDraft] = React.useState('');

    function resetAddRow() {
        setDraft('');
        setIsAdding(false);
    }

    function addDraft() {
        const value = draft.trim();

        if (!(value && !values.includes(value))) {
            return;
        }

        onValuesChange([...values, value]);
        resetAddRow();
    }

    function removeValue(value: string) {
        onValuesChange(values.filter((candidate) => candidate !== value));
    }

    return (
        <section>
            <div className="flex items-start justify-between gap-3 pb-3">
                <div className="min-w-0">
                    <h3 className="font-medium text-foreground text-sm">{title}</h3>
                </div>
            </div>

            <CardFrame>
                <Card className="overflow-hidden p-0">
                    {isAdding ? (
                        <SettingsRow key="add-row" title={addLabel}>
                            <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                                <Input
                                    autoFocus
                                    disabled={disabled}
                                    onChange={(event) => setDraft(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault();
                                            addDraft();
                                        }
                                    }}
                                    placeholder={placeholder}
                                    value={draft}
                                />
                                <div className="flex shrink-0 gap-2">
                                    <Button
                                        disabled={disabled || draft.trim().length === 0}
                                        onClick={addDraft}
                                        size="sm"
                                        type="button"
                                    >
                                        Add
                                    </Button>
                                    <Button
                                        onClick={resetAddRow}
                                        size="sm"
                                        type="button"
                                        variant="secondary"
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        </SettingsRow>
                    ) : null}

                    {values.length > 0 ? (
                        values.map((value, index) => (
                            <React.Fragment key={value}>
                                {isAdding || index > 0 ? <Separator /> : null}
                                <SettingsItem className="py-2">
                                    <div className="grid min-w-0 grid-cols-[1fr_auto] items-center gap-2">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <Badge size="sm" variant="subtle">
                                                Mention
                                            </Badge>
                                            <span className="min-w-0 truncate font-mono font-normal text-meta">
                                                {value}
                                            </span>
                                        </div>
                                        <Button
                                            aria-label={`Delete ${itemLabel} ${value}`}
                                            className="-mr-3"
                                            disabled={disabled}
                                            onClick={() => removeValue(value)}
                                            size="icon"
                                            type="button"
                                            variant="destructive-ghost"
                                        >
                                            <Icon icon={Trash2} />
                                        </Button>
                                    </div>
                                </SettingsItem>
                            </React.Fragment>
                        ))
                    ) : isAdding ? null : (
                        <SettingsItem className="py-5 text-center text-muted-foreground text-sm">
                            {emptyLabel}
                        </SettingsItem>
                    )}
                    <Separator />
                    <SettingsActionRow
                        disabled={disabled || isAdding}
                        onClick={() => setIsAdding(true)}
                    >
                        <Icon aria-hidden="true" className="opacity-100" icon={Plus} />
                        Add {itemLabel}
                    </SettingsActionRow>
                </Card>
            </CardFrame>
        </section>
    );
}
