import { ArrowUp01Icon, ArrowUp02Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { useChatDraftLaunch } from '../../hooks/chats/use-chat-draft-launch.ts';
import type { AgentListOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import {
    buildToolMentionMetadata,
    normalizeToolMentions,
} from '../tool-mentions/tool-mention-text.ts';
import type { ToolMention } from '../tool-mentions/tool-mention-types.ts';
import { useToolMentionComposer } from '../tool-mentions/use-tool-mention-composer.tsx';
import { handleChatComposerKeyDown } from './chat-composer-keyboard.ts';

type Agent = AgentListOutput['agents'][number];

export function StartChatComposer({
    agent,
    className,
    density = 'overview',
    id,
}: {
    agent: Agent | null;
    className?: string;
    density?: 'agent' | 'overview';
    id?: string;
}) {
    const launchChatDraft = useChatDraftLaunch();
    const [prompt, setPrompt] = React.useState('');
    const [toolMentions, setToolMentions] = React.useState<ToolMention[]>([]);

    const isPromptReady = prompt.trim().length > 0 && agent !== null;
    const handleSubmit = React.useEffectEvent((event?: React.FormEvent<HTMLFormElement>) => {
        event?.preventDefault();

        if (!(agent && isPromptReady)) {
            return;
        }

        const leadingTrimLength = prompt.length - prompt.trimStart().length;
        const submittedPrompt = prompt.trim();
        const submittedMentions = normalizeToolMentions(
            submittedPrompt,
            toolMentions.map((mention) => ({
                ...mention,
                end: mention.end - leadingTrimLength,
                start: mention.start - leadingTrimLength,
            }))
        );
        const metadata = buildToolMentionMetadata(submittedMentions);

        setPrompt('');
        setToolMentions([]);
        launchChatDraft({
            agentId: agent.id,
            content: submittedPrompt,
            metadata,
        });
    });
    const handleTextKeyDown = React.useCallback(
        (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
            handleChatComposerKeyDown({
                event,
                onSubmit: () => {
                    void handleSubmit();
                },
                onValueChange: setPrompt,
                value: prompt,
            });
        },
        [prompt]
    );
    const toolMentionComposer = useToolMentionComposer({
        agentId: agent?.id ?? '',
        agents: agent ? [agent] : [],
        content: prompt,
        onTextChange: setPrompt,
        onTextKeyDown: handleTextKeyDown,
        onToolMentionsChange: setToolMentions,
    });

    const isAgentDensity = density === 'agent';

    return (
        <form
            className={cn(isAgentDensity ? null : 'mt-8 w-full', className)}
            onSubmit={handleSubmit}
        >
            {agent ? (
                <div className="group relative rounded-2xl border border-border-strong/60 bg-card shadow-sm transition-shadow focus-within:border-brand/40 focus-within:shadow-[0_0_0_3px_var(--brand-ring)]">
                    {toolMentionComposer.textOverlay ? (
                        <div
                            aria-hidden
                            className={cn(
                                'pointer-events-none absolute inset-0 whitespace-pre-wrap break-words px-5 pb-14 text-foreground',
                                isAgentDensity ? 'pt-4 text-chat' : 'pt-5 text-sm leading-normal'
                            )}
                        >
                            {toolMentionComposer.textOverlay}
                        </div>
                    ) : null}
                    <textarea
                        className={cn(
                            'w-full resize-none rounded-2xl bg-transparent px-5 pb-14 text-foreground outline-none placeholder:text-muted-foreground/60',
                            isAgentDensity ? 'pt-4 text-chat' : 'pt-5 text-sm',
                            toolMentionComposer.textOverlay &&
                                'text-transparent caret-foreground selection:bg-ring/25'
                        )}
                        id={id ?? (isAgentDensity ? `agent-${agent.id}-prompt` : 'home-prompt')}
                        onChange={(event) =>
                            toolMentionComposer.onTextChange(event.target.value, event.target)
                        }
                        onClick={toolMentionComposer.onTextSelect}
                        onKeyDown={toolMentionComposer.onTextKeyDown}
                        onKeyUp={toolMentionComposer.onTextSelect}
                        onSelect={toolMentionComposer.onTextSelect}
                        placeholder={
                            isAgentDensity
                                ? `Send a message to ${agent.name}...`
                                : 'Ask Tavern to investigate, summarize, or take the next step...'
                        }
                        ref={toolMentionComposer.textareaRef}
                        rows={isAgentDensity ? 2 : 3}
                        value={prompt}
                    />
                    {toolMentionComposer.composerPopover}

                    <div
                        className={cn(
                            'absolute right-3 left-3 flex items-center',
                            isAgentDensity ? 'bottom-2.5 justify-end' : 'bottom-3.5 justify-between'
                        )}
                    >
                        <div />
                        <Button
                            aria-label="Start chat"
                            className={cn(
                                'shrink-0',
                                isAgentDensity ? 'size-8 rounded-lg' : 'rounded-full'
                            )}
                            disabled={!isPromptReady}
                            size={isAgentDensity ? 'icon' : 'icon-sm'}
                            type="submit"
                        >
                            <Icon
                                icon={isAgentDensity ? ArrowUp01Icon : ArrowUp02Icon}
                                size={16}
                                strokeWidth={isAgentDensity ? undefined : 2.5}
                            />
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="relative rounded-2xl border border-border bg-muted/55 shadow-none">
                    <textarea
                        aria-label="Chat composer unavailable"
                        className="w-full resize-none rounded-2xl bg-transparent px-5 pt-5 pb-14 text-muted-foreground/80 text-sm outline-none placeholder:text-muted-foreground/70 disabled:cursor-not-allowed"
                        disabled
                        placeholder="Start Tavern Runtime to sync your agent."
                        rows={3}
                    />

                    <div className="absolute right-3.5 bottom-3 left-3.5 flex items-center justify-between">
                        <Button
                            render={<Link to="/dashboard/settings/agent-runtime" />}
                            size="sm"
                            variant="secondary"
                        >
                            Tavern Runtime
                        </Button>

                        <Button
                            aria-label="Start chat"
                            className="shrink-0 rounded-full"
                            disabled
                            size="icon-sm"
                            type="submit"
                        >
                            <Icon icon={ArrowUp02Icon} size={16} strokeWidth={2.5} />
                        </Button>
                    </div>
                </div>
            )}
        </form>
    );
}
