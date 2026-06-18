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
    TextBoldIcon,
    TextItalicIcon,
    WikipediaIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Tooltip } from '../../components/ui/tooltip.tsx';
import { cn } from '../../lib/utils.ts';
import { applyMarkdownCommand, type VaultMarkdownCommand } from './vault-markdown-editor-utils.ts';

interface VaultMarkdownEditorProps {
    className?: string;
    disabled?: boolean;
    onChange: (value: string) => void;
    onSave: () => void;
    saveDisabled: boolean;
    value: string;
}

const toolbarGroups: Array<
    Array<{ command: VaultMarkdownCommand; icon: IconSvgElement; label: string }>
> = [
    [
        { command: 'heading-1', icon: Heading01Icon, label: 'Heading 1' },
        { command: 'heading-2', icon: Heading02Icon, label: 'Heading 2' },
        { command: 'heading-3', icon: Heading03Icon, label: 'Heading 3' },
    ],
    [
        { command: 'bold', icon: TextBoldIcon, label: 'Bold' },
        { command: 'italic', icon: TextItalicIcon, label: 'Italic' },
        { command: 'code', icon: CodeCircleIcon, label: 'Inline code' },
    ],
    [
        { command: 'bullet-list', icon: LeftToRightListBulletIcon, label: 'Bullet list' },
        { command: 'number-list', icon: LeftToRightListNumberIcon, label: 'Numbered list' },
        { command: 'check-list', icon: CheckListIcon, label: 'Checklist' },
        { command: 'blockquote', icon: LeftToRightBlockQuoteIcon, label: 'Quote' },
    ],
    [
        { command: 'link', icon: Link02Icon, label: 'Markdown link' },
        { command: 'wikilink', icon: WikipediaIcon, label: 'Wikilink' },
    ],
];

export function VaultMarkdownEditor({
    className,
    disabled = false,
    onChange,
    onSave,
    saveDisabled,
    value,
}: VaultMarkdownEditorProps) {
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

    function applyCommand(command: VaultMarkdownCommand) {
        const textarea = textareaRef.current;
        if (!textarea) {
            return;
        }
        const edit = applyMarkdownCommand(
            value,
            { end: textarea.selectionEnd, start: textarea.selectionStart },
            command
        );
        onChange(edit.value);
        window.requestAnimationFrame(() => {
            textarea.focus();
            textarea.setSelectionRange(edit.selection.start, edit.selection.end);
        });
    }

    return (
        <div className={cn('flex min-h-0 flex-col', className)}>
            <div className="flex min-h-9 items-center gap-1 border-border/70 border-b bg-muted/20 px-2">
                {toolbarGroups.map((group, index) => (
                    <React.Fragment key={group.map((item) => item.command).join('-')}>
                        {index > 0 ? <div className="mx-1 h-4 w-px bg-border" /> : null}
                        {group.map((item) => (
                            <Tooltip content={item.label} key={item.command}>
                                <Button
                                    aria-label={item.label}
                                    disabled={disabled}
                                    onClick={() => applyCommand(item.command)}
                                    size="icon-xs"
                                    variant="ghost"
                                >
                                    <Icon icon={item.icon} />
                                </Button>
                            </Tooltip>
                        ))}
                    </React.Fragment>
                ))}
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
                <textarea
                    aria-label="Markdown body"
                    className="min-h-full w-full resize-none bg-background px-4 py-3 font-mono text-[13px] text-foreground leading-6 outline-none placeholder:text-muted-foreground"
                    disabled={disabled}
                    onChange={(event) => onChange(event.currentTarget.value)}
                    onKeyDown={(event) => {
                        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
                            event.preventDefault();
                            if (!saveDisabled) {
                                onSave();
                            }
                        }
                    }}
                    placeholder="# Untitled"
                    ref={textareaRef}
                    spellCheck
                    value={value}
                />
            </div>
        </div>
    );
}
