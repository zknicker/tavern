import type { IconSvgElement } from '@hugeicons/react';
import {
    CheckListIcon,
    CodeCircleIcon,
    Heading01Icon,
    Heading02Icon,
    Heading03Icon,
    LeftToRightBlockQuoteIcon,
    LeftToRightListBulletIcon,
    LeftToRightListNumberIcon,
    Link02Icon,
    MinusSignIcon,
    TableIcon,
    TextBoldIcon,
    TextItalicIcon,
    TextUnderlineIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import {
    applyBlockType$,
    applyFormat$,
    applyListType$,
    currentBlockType$,
    currentFormat$,
    currentListType$,
    IS_BOLD,
    IS_CODE,
    IS_ITALIC,
    IS_UNDERLINE,
    insertCodeBlock$,
    insertMarkdown$,
    insertTable$,
    insertThematicBreak$,
    openLinkEditDialog$,
} from '@mdxeditor/editor';
import { useCellValue, usePublisher } from '@mdxeditor/gurx';
import type * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Tooltip } from '../../components/ui/tooltip.tsx';
import { cn } from '../../lib/utils.ts';

export function WikiEditorToolbar() {
    const applyBlockType = usePublisher(applyBlockType$);
    const applyFormat = usePublisher(applyFormat$);
    const applyListType = usePublisher(applyListType$);
    const currentBlockType = useCellValue(currentBlockType$);
    const currentFormat = useCellValue(currentFormat$);
    const currentListType = useCellValue(currentListType$);
    const insertCodeBlock = usePublisher(insertCodeBlock$);
    const insertMarkdown = usePublisher(insertMarkdown$);
    const insertTable = usePublisher(insertTable$);
    const insertThematicBreak = usePublisher(insertThematicBreak$);
    const openLinkDialog = usePublisher(openLinkEditDialog$);

    const formatActive = (format: number) => (currentFormat & format) !== 0;

    return (
        <div className="wiki-mdx-toolbar-shell">
            <div className="wiki-mdx-toolbar-groups">
                <ToolbarGroup>
                    {blockCommands.map((command) => (
                        <ToolbarButton
                            active={currentBlockType === command.value}
                            icon={command.icon}
                            key={command.value}
                            label={command.label}
                            onClick={() => applyBlockType(command.value)}
                        />
                    ))}
                </ToolbarGroup>
                <ToolbarGroup>
                    <ToolbarButton
                        active={formatActive(IS_BOLD)}
                        icon={TextBoldIcon}
                        label="Bold"
                        onClick={() => applyFormat('bold')}
                    />
                    <ToolbarButton
                        active={formatActive(IS_ITALIC)}
                        icon={TextItalicIcon}
                        label="Italic"
                        onClick={() => applyFormat('italic')}
                    />
                    <ToolbarButton
                        active={formatActive(IS_UNDERLINE)}
                        icon={TextUnderlineIcon}
                        label="Underline"
                        onClick={() => applyFormat('underline')}
                    />
                    <ToolbarButton
                        active={formatActive(IS_CODE)}
                        icon={CodeCircleIcon}
                        label="Inline code"
                        onClick={() => applyFormat('code')}
                    />
                </ToolbarGroup>
                <ToolbarGroup>
                    {listCommands.map((command) => (
                        <ToolbarButton
                            active={currentListType === command.value}
                            icon={command.icon}
                            key={command.value}
                            label={command.label}
                            onClick={() =>
                                applyListType(
                                    currentListType === command.value ? '' : command.value
                                )
                            }
                        />
                    ))}
                    <ToolbarButton
                        active={currentBlockType === 'quote'}
                        icon={LeftToRightBlockQuoteIcon}
                        label="Quote"
                        onClick={() => applyBlockType('quote')}
                    />
                </ToolbarGroup>
                <ToolbarGroup>
                    <ToolbarButton
                        icon={Link02Icon}
                        label="Markdown link"
                        onClick={() => openLinkDialog()}
                    />
                    <ToolbarButton
                        icon={Link02Icon}
                        label="Wiki link"
                        onClick={() => insertMarkdown('[[Page name]]')}
                    />
                </ToolbarGroup>
                <ToolbarGroup>
                    <ToolbarButton
                        icon={CodeCircleIcon}
                        label="Code block"
                        onClick={() => insertCodeBlock({})}
                    />
                    <ToolbarButton
                        icon={TableIcon}
                        label="Table"
                        onClick={() => insertTable({ columns: 3, rows: 3 })}
                    />
                    <ToolbarButton
                        icon={MinusSignIcon}
                        label="Divider"
                        onClick={() => insertThematicBreak()}
                    />
                </ToolbarGroup>
            </div>
        </div>
    );
}

const blockCommands = [
    { icon: Heading01Icon, label: 'Heading 1', value: 'h1' },
    { icon: Heading02Icon, label: 'Heading 2', value: 'h2' },
    { icon: Heading03Icon, label: 'Heading 3', value: 'h3' },
] as const;

const listCommands = [
    { icon: LeftToRightListBulletIcon, label: 'Bullet list', value: 'bullet' },
    { icon: LeftToRightListNumberIcon, label: 'Numbered list', value: 'number' },
    { icon: CheckListIcon, label: 'Checklist', value: 'check' },
] as const;

function ToolbarGroup({ children }: { children: React.ReactNode }) {
    return <div className="wiki-mdx-toolbar-group">{children}</div>;
}

function ToolbarButton({
    active = false,
    disabled = false,
    icon,
    label,
    onClick,
}: {
    active?: boolean;
    disabled?: boolean;
    icon: IconSvgElement;
    label: string;
    onClick: () => void;
}) {
    return (
        <Tooltip content={label}>
            <Button
                aria-label={label}
                className={cn(active && 'bg-accent')}
                disabled={disabled}
                onClick={onClick}
                size="icon-sm"
                variant={active ? 'secondary' : 'ghost'}
            >
                <Icon icon={icon} />
            </Button>
        </Tooltip>
    );
}
