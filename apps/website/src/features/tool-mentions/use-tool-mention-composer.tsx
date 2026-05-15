import * as React from 'react';
import type { AgentListOutput } from '../../lib/trpc.tsx';
import { ToolMentionContent } from './tool-mention-content.tsx';
import { ToolMentionPicker } from './tool-mention-picker.tsx';
import {
    getActiveToolMentionQuery,
    reconcileToolMentions,
    selectToolMention,
} from './tool-mention-text.ts';
import type { ToolMention, ToolMentionOption } from './tool-mention-types.ts';
import { useToolMentionOptions } from './use-tool-mention-options.ts';

export function useToolMentionComposer({
    agentId,
    agents,
    content,
    onTextChange,
    onTextKeyDown,
    onToolMentionsChange,
}: {
    agentId: string;
    agents: AgentListOutput['agents'];
    content: string;
    onTextChange: (content: string) => void;
    onTextKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
    onToolMentionsChange?: (mentions: ToolMention[]) => void;
}) {
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
    const [caretIndex, setCaretIndex] = React.useState<number | null>(null);
    const [mentions, setMentions] = React.useState<ToolMention[]>([]);
    const [activeIndex, setActiveIndex] = React.useState(0);
    const activeQuery = getActiveToolMentionQuery(content, caretIndex);
    const mentionOptions = useToolMentionOptions({
        agentId,
        agents,
        query: activeQuery?.query ?? '',
    });
    const visibleMentionOptions = activeQuery ? mentionOptions : [];

    React.useEffect(() => {
        if (visibleMentionOptions.length === 0) {
            setActiveIndex(0);
            return;
        }

        setActiveIndex((index) => Math.min(index, visibleMentionOptions.length - 1));
    }, [visibleMentionOptions.length]);

    React.useEffect(() => {
        if (content.length === 0 && mentions.length > 0) {
            setMentions([]);
            onToolMentionsChange?.([]);
        }
    }, [content.length, mentions.length, onToolMentionsChange]);

    function commitMentions(nextMentions: ToolMention[]) {
        setMentions(nextMentions);
        onToolMentionsChange?.(nextMentions);
    }

    function handleTextChange(nextContent: string, element: HTMLTextAreaElement) {
        const nextMentions = reconcileToolMentions(content, nextContent, mentions);

        onTextChange(nextContent);
        setCaretIndex(element.selectionStart);
        commitMentions(nextMentions);
    }

    function handleTextSelection(event: React.SyntheticEvent<HTMLTextAreaElement>) {
        setCaretIndex(event.currentTarget.selectionStart);
    }

    function handleToolMentionSelect(option: ToolMentionOption) {
        if (!activeQuery) {
            return;
        }

        const { nextCaretIndex, nextContent, nextMentions } = selectToolMention({
            activeQuery,
            content,
            mentions,
            option,
        });

        onTextChange(nextContent);
        commitMentions(nextMentions);
        setCaretIndex(nextCaretIndex);

        window.requestAnimationFrame(() => {
            textareaRef.current?.focus();
            textareaRef.current?.setSelectionRange(nextCaretIndex, nextCaretIndex);
        });
    }

    function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (visibleMentionOptions.length > 0 && handlePickerKeyDown(event)) {
            return;
        }

        onTextKeyDown?.(event);
    }

    function handlePickerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex((index) => (index + 1) % visibleMentionOptions.length);
            return true;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex(
                (index) => (index - 1 + visibleMentionOptions.length) % visibleMentionOptions.length
            );
            return true;
        }

        if (event.key === 'Enter' || event.key === 'Tab') {
            event.preventDefault();
            handleToolMentionSelect(visibleMentionOptions[activeIndex]);
            return true;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            setCaretIndex(null);
            return true;
        }

        return false;
    }

    return {
        composerPopover: (
            <ToolMentionPicker
                activeIndex={activeIndex}
                onSelect={handleToolMentionSelect}
                options={visibleMentionOptions}
            />
        ),
        onTextChange: handleTextChange,
        onTextKeyDown: handleKeyDown,
        onTextSelect: handleTextSelection,
        textareaRef,
        textOverlay:
            mentions.length > 0 ? (
                <ToolMentionContent content={content} mentions={mentions} mentionVariant="text" />
            ) : null,
    };
}
