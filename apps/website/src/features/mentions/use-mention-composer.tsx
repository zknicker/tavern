import * as React from 'react';
import { queryPolicy } from '../../lib/query-policy.ts';
import { type AgentListOutput, trpc } from '../../lib/trpc.tsx';
import { MentionEditor, type MentionEditorHandle } from './mention-editor.tsx';
import { MentionPicker } from './mention-picker.tsx';
import type { ActiveMentionQuery, Mention, MentionOption } from './mention-types.ts';
import { filterCommandOptionsForQuery, useCommandOptions } from './use-command-options.ts';
import { useMentionOptions } from './use-mention-options.ts';

export interface MentionComposerState {
    activeIndex: number;
    editorRef: React.RefObject<MentionEditorHandle | null>;
    focusTextEditor: () => void;
    handleKeyDown: (event: KeyboardEvent) => boolean;
    handleMentionSelect: (option: MentionOption) => void;
    handleTextChange: (content: string, mentions: Mention[]) => void;
    hasQuery: boolean;
    isPathSearchActive: boolean;
    isPathSearchLoading: boolean;
    onActiveQueryChange: (query: ActiveMentionQuery | null) => void;
    options: MentionOption[];
    prefetchMentionOptions: () => void;
    value: string;
}

export function useMentionComposer({
    agentId,
    agents,
    content,
    onTextChange,
    onSubmit,
    onMentionsChange,
    supportsCommands = false,
}: {
    agentId: string;
    agents: AgentListOutput['agents'];
    content: string;
    onTextChange: (content: string) => void;
    onSubmit?: () => void;
    onMentionsChange?: (mentions: Mention[]) => void;
    // Commands run in an existing chat session; the new-chat composer
    // leaves the `/` palette off.
    supportsCommands?: boolean;
}) {
    const utils = trpc.useUtils();
    const editorRef = React.useRef<MentionEditorHandle | null>(null);
    const dismissedQueryRef = React.useRef<ActiveMentionQuery | null>(null);
    const [mentions, setMentions] = React.useState<Mention[]>([]);
    const [activeQuery, setActiveQuery] = React.useState<ActiveMentionQuery | null>(null);
    const [activeIndex, setActiveIndex] = React.useState(0);
    const mentionOptionsState = useMentionOptions({
        agentId,
        agents,
        query: activeQuery?.query ?? '',
    });
    const commandOptions = useCommandOptions({ enabled: supportsCommands });
    const trigger = activeQuery?.trigger ?? '@';
    const visibleMentionOptions = selectVisibleOptions({
        activeQuery,
        commandOptions,
        mentionOptions: mentionOptionsState.options,
        supportsCommands,
    });
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
        dismissedQueryRef.current = null;

        if (option.kind === 'command') {
            editorRef.current?.replaceActiveQuery(option.insertText);
            return;
        }

        editorRef.current?.insertMention(option);
    }

    function handleKeyDown(event: KeyboardEvent) {
        return handlePickerKeyDown(event) || handleSubmitKeyDown(event);
    }

    function handlePickerKeyDown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            if (!(activeQuery || dismissedQueryRef.current)) {
                return false;
            }

            event.preventDefault();
            dismissedQueryRef.current = activeQuery ?? dismissedQueryRef.current;
            setActiveQuery(null);
            return true;
        }

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

        if (
            (event.key === 'Enter' && !(event.metaKey || event.ctrlKey || event.shiftKey)) ||
            event.key === 'Tab'
        ) {
            event.preventDefault();
            handleMentionSelect(visibleMentionOptions[activeIndex]);
            return true;
        }

        return false;
    }

    function handleActiveQueryChange(query: ActiveMentionQuery | null) {
        if (!query || (query.trigger === '/' && !supportsCommands)) {
            dismissedQueryRef.current = null;
            setActiveQuery(null);
            return;
        }

        if (isSameMentionQuery(query, dismissedQueryRef.current)) {
            setActiveQuery(null);
            return;
        }

        dismissedQueryRef.current = null;
        setActiveQuery(query);
    }

    function handleSubmitKeyDown(event: KeyboardEvent) {
        if (
            event.key !== 'Enter' ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.isComposing
        ) {
            return false;
        }

        event.preventDefault();
        onSubmit?.();
        return true;
    }

    return {
        activeIndex,
        editorRef,
        focusTextEditor: () => editorRef.current?.focus(),
        handleKeyDown,
        handleMentionSelect,
        handleTextChange,
        hasQuery: Boolean(activeQuery),
        isPathSearchActive: trigger === '@' && mentionOptionsState.isPathSearchActive,
        isPathSearchLoading: trigger === '@' && mentionOptionsState.isPathSearchLoading,
        onActiveQueryChange: handleActiveQueryChange,
        options: visibleMentionOptions,
        prefetchMentionOptions,
        value: content,
    } satisfies MentionComposerState;
}

function isSameMentionQuery(left: ActiveMentionQuery, right: ActiveMentionQuery | null) {
    return (
        right !== null &&
        left.end === right.end &&
        left.query === right.query &&
        left.start === right.start &&
        left.trigger === right.trigger
    );
}

function selectVisibleOptions({
    activeQuery,
    commandOptions,
    mentionOptions,
    supportsCommands,
}: {
    activeQuery: ActiveMentionQuery | null;
    commandOptions: MentionOption[];
    mentionOptions: MentionOption[];
    supportsCommands: boolean;
}) {
    if (!activeQuery) {
        return [];
    }

    if (activeQuery.trigger === '/') {
        return supportsCommands
            ? filterCommandOptionsForQuery(commandOptions, activeQuery.query)
            : [];
    }

    if (activeQuery.trigger === '$') {
        return mentionOptions.filter((option) => option.kind === 'skill');
    }

    return mentionOptions;
}

export function MentionComposerEditor({
    ariaLabel,
    autoFocus,
    composer,
    disabled,
    id,
    name,
    placeholder,
}: {
    ariaLabel: string;
    autoFocus?: boolean;
    composer: MentionComposerState;
    disabled?: boolean;
    id?: string;
    name: string;
    placeholder?: string;
}) {
    return (
        <MentionEditor
            ariaLabel={ariaLabel}
            autoFocus={autoFocus}
            disabled={disabled}
            id={id}
            name={name}
            onActiveQueryChange={composer.onActiveQueryChange}
            onChange={composer.handleTextChange}
            onFocus={composer.prefetchMentionOptions}
            onKeyDown={composer.handleKeyDown}
            placeholder={placeholder}
            ref={composer.editorRef}
            value={composer.value}
        />
    );
}

export function MentionComposerPicker({ composer }: { composer: MentionComposerState }) {
    return (
        <MentionPicker
            activeIndex={composer.activeIndex}
            hasQuery={composer.hasQuery}
            isPathSearchActive={composer.isPathSearchActive}
            isPathSearchLoading={composer.isPathSearchLoading}
            onSelect={composer.handleMentionSelect}
            options={composer.options}
        />
    );
}
