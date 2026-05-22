import { Plus } from '@hugeicons/core-free-icons';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { ChatComposer } from '../../components/ui/chat-composer.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { useChatDraftLaunch } from '../../hooks/chats/use-chat-draft-launch.ts';
import type { AgentListOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import {
    buildMentionMetadata,
    compileMentionSubmission,
    normalizeMentions,
} from '../mentions/mention-text.ts';
import type { Mention } from '../mentions/mention-types.ts';
import { useMentionComposer } from '../mentions/use-mention-composer.tsx';

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
    const [mentions, setMentions] = React.useState<Mention[]>([]);

    const isPromptReady = prompt.trim().length > 0 && agent !== null;
    const handleSubmit = React.useEffectEvent((event?: React.FormEvent<HTMLFormElement>) => {
        event?.preventDefault();

        if (!(agent && isPromptReady)) {
            return;
        }

        const leadingTrimLength = prompt.length - prompt.trimStart().length;
        const submittedPrompt = prompt.trimStart();
        const submittedMentions = normalizeMentions(
            submittedPrompt,
            mentions.map((mention) => ({
                ...mention,
                end: mention.end - leadingTrimLength,
                start: mention.start - leadingTrimLength,
            }))
        );
        const submission = compileMentionSubmission(submittedPrompt, submittedMentions);
        const metadata = buildMentionMetadata(submission.mentions);

        setPrompt('');
        setMentions([]);
        launchChatDraft({
            agentId: agent.id,
            content: submission.content.trim(),
            metadata,
        });
    });
    const mentionComposer = useMentionComposer({
        agentId: agent?.id ?? '',
        agents: agent ? [agent] : [],
        content: prompt,
        onTextChange: setPrompt,
        onSubmit: () => {
            void handleSubmit();
        },
        onMentionsChange: setMentions,
    });

    const isAgentDensity = density === 'agent';
    const promptId =
        id ?? (isAgentDensity ? `agent-${agent?.id ?? 'unknown'}-prompt` : 'home-prompt');
    const placeholder = agent
        ? isAgentDensity
            ? `Send a message to ${agent.name}...`
            : 'Ask Tavern to investigate, summarize, or take the next step...'
        : 'Start Tavern Runtime to sync your agent.';

    return (
        <ChatComposer
            canSubmit={isPromptReady}
            className={cn(isAgentDensity ? 'p-0' : 'mt-8 w-full p-0', className)}
            composerPopover={agent ? mentionComposer.composerPopover : null}
            contentClassName="max-w-none"
            disabled={!agent}
            footerStart={
                agent ? (
                    <Button
                        aria-label="Attach file"
                        disabled
                        size="icon"
                        title="Attachments are not available for sending yet."
                        type="button"
                        variant="ghost"
                    >
                        <Icon icon={Plus} />
                    </Button>
                ) : (
                    <Button
                        render={<Link to="/dashboard/settings/agent-runtime" />}
                        size="sm"
                        variant="secondary"
                    >
                        Tavern Runtime
                    </Button>
                )
            }
            name="start-chat"
            onSubmit={handleSubmit}
            onTextChange={(value) => {
                if (agent) {
                    setPrompt(value);
                }
            }}
            onTextEditorFocus={agent ? mentionComposer.focusTextEditor : undefined}
            placeholder={placeholder}
            submitButtonClassName={cn(isAgentDensity ? null : 'rounded-full')}
            submitButtonLabel="Start chat"
            submitButtonSize="icon"
            surfaceClassName={agent ? undefined : 'bg-muted/55 shadow-none'}
            textareaId={promptId}
            textareaRows={1}
            textEditor={
                agent
                    ? mentionComposer.renderTextEditor({
                          disabled: !agent,
                          id: promptId,
                          name: 'start-chat',
                          placeholder,
                      })
                    : undefined
            }
            value={prompt}
        />
    );
}
