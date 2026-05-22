import * as React from 'react';
import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc, type AgentListOutput } from '../../lib/trpc.tsx';
import { MentionEditor, type MentionEditorHandle } from './mention-editor.tsx';
import { MentionPicker } from './mention-picker.tsx';
import type { Mention, MentionOption } from './mention-types.ts';
import { useMentionOptions } from './use-mention-options.ts';

export function useMentionComposer({
    agentId,
    agents,
    content,
    onTextChange,
    onSubmit,
    onMentionsChange,
}: {
    agentId: string;
    agents: AgentListOutput['agents'];
    content: string;
    onTextChange: (content: string) => void;
    onSubmit?: () => void;
    onMentionsChange?: (mentions: Mention[]) => void;
}) {
    const utils = trpc.useUtils();
    const editorRef = React.useRef<MentionEditorHandle | null>(null);
    const [mentions, setMentions] = React.useState<Mention[]>([]);
    const [activeQuery, setActiveQuery] = React.useState<{ query: string } | null>(null);
    const [activeIndex, setActiveIndex] = React.useState(0);
    const mentionOptionsState = useMentionOptions({
        agentId,
        agents,
        query: activeQuery?.query ?? '',
    });
    const visibleMentionOptions = activeQuery ? mentionOptionsState.options : [];
    const prefetchMentionOptions = React.useCallback(() => {
        if (!agentId) {
            return;
        }

        void utils.mention.inventory.prefetch(
            {
                agentId,
            },
            queryPolicy.agentRuntimeSnapshot
        );
    }, [agentId, utils]);

    React.useEffect(() => {
        prefetchMentionOptions();
    }, [prefetchMentionOptions]);

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
            onMentionsChange?.([]);
        }
    }, [content.length, mentions.length, onMentionsChange]);

    function commitMentions(nextMentions: Mention[]) {
        setMentions(nextMentions);
        onMentionsChange?.(nextMentions);
    }

    function handleTextChange(nextContent: string, nextMentions: Mention[]) {
        onTextChange(nextContent);
        commitMentions(nextMentions);
    }

    function handleMentionSelect(option: MentionOption) {
        editorRef.current?.insertMention(option);
    }

    function handleKeyDown(event: KeyboardEvent) {
        return handlePickerKeyDown(event) || handleSubmitKeyDown(event);
    }

    function handlePickerKeyDown(event: KeyboardEvent) {
        if (visibleMentionOptions.length === 0) {
            return false;
        }

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
            handleMentionSelect(visibleMentionOptions[activeIndex]);
            return true;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            setActiveQuery(null);
            return true;
        }

        return false;
    }

    function handleSubmitKeyDown(event: KeyboardEvent) {
        if (event.key !== 'Enter' || event.metaKey || event.isComposing) {
            return false;
        }

        event.preventDefault();
        onSubmit?.();
        return true;
    }

    return {
        composerPopover: (
            <MentionPicker
                activeIndex={activeIndex}
                hasQuery={Boolean(activeQuery)}
                isPathSearchActive={mentionOptionsState.isPathSearchActive}
                isPathSearchLoading={mentionOptionsState.isPathSearchLoading}
                onSelect={handleMentionSelect}
                options={visibleMentionOptions}
            />
        ),
        focusTextEditor: () => editorRef.current?.focus(),
        renderTextEditor: ({
            disabled,
            id,
            name,
            placeholder,
        }: {
            disabled?: boolean;
            id?: string;
            name: string;
            placeholder: string;
        }) => (
            <MentionEditor
                disabled={disabled}
                id={id}
                name={name}
                onActiveQueryChange={setActiveQuery}
                onChange={handleTextChange}
                onFocus={prefetchMentionOptions}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                ref={editorRef}
                value={content}
            />
        ),
    };
}
