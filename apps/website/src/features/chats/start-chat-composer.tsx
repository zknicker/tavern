import { Plus } from '@hugeicons/core-free-icons';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import {
    PromptInput,
    PromptInputActions,
    PromptInputBody,
    PromptInputButton,
    PromptInputFooter,
    PromptInputSubmit,
    PromptInputTextarea,
    PromptInputTools,
} from '../../components/ui/prompt-input.tsx';
import { useChatDraftLaunch } from '../../hooks/chats/use-chat-draft-launch.ts';
import { useAgentRuntimeCapability } from '../../hooks/connections/use-agent-runtime-capability.ts';
import type { AgentListOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import {
    buildMentionMetadata,
    compileMentionSubmission,
    normalizeMentions,
} from '../mentions/mention-text.ts';
import type { Mention } from '../mentions/mention-types.ts';
import {
    MentionComposerEditor,
    MentionComposerPicker,
    useMentionComposer,
} from '../mentions/use-mention-composer.tsx';

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
    const gatewayCapability = useAgentRuntimeCapability('gateway');
    const mentionsCapability = useAgentRuntimeCapability('mentions');
    const messagesCapability = useAgentRuntimeCapability('messages');
    const [prompt, setPrompt] = React.useState('');
    const [mentions, setMentions] = React.useState<Mention[]>([]);

    const canSendToRuntime = gatewayCapability.healthy && messagesCapability.healthy;
    const canUseMentions = Boolean(agent && mentionsCapability.healthy);
    const isPromptReady = prompt.trim().length > 0 && agent !== null;
    const canSubmit = isPromptReady && canSendToRuntime;
    const runtimeDisabledReason =
        gatewayCapability.reason ??
        messagesCapability.reason ??
        'Tavern Runtime is not ready for sending.';
    const handleSubmit = React.useEffectEvent((event?: React.FormEvent<HTMLFormElement>) => {
        event?.preventDefault();

        if (!(agent && canSubmit)) {
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
        agentId: canUseMentions && agent ? agent.id : '',
        agents: canUseMentions && agent ? [agent] : [],
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
        <PromptInput
            className={cn(isAgentDensity ? 'p-0' : 'mt-8 w-full p-0', className)}
            contentClassName="max-w-none"
            onSubmit={handleSubmit}
            onTextEditorFocus={canUseMentions ? mentionComposer.focusTextEditor : undefined}
        >
            <PromptInputBody>
                {canUseMentions ? (
                    <MentionComposerEditor
                        composer={mentionComposer}
                        id={promptId}
                        name="start-chat"
                        placeholder={placeholder}
                    />
                ) : (
                    <PromptInputTextarea
                        aria-label={placeholder}
                        id={promptId}
                        name="start-chat"
                        onChange={(event) => setPrompt(event.target.value)}
                        placeholder={placeholder}
                        rows={1}
                        value={prompt}
                    />
                )}
            </PromptInputBody>
            {canUseMentions ? <MentionComposerPicker composer={mentionComposer} /> : null}
            <PromptInputFooter>
                <PromptInputTools>
                    <PromptInputButton
                        aria-label="Attach file"
                        disabled
                        size="icon"
                        tooltip="Attachments are not available for sending yet."
                        type="button"
                        variant="ghost"
                    >
                        <Icon icon={Plus} />
                    </PromptInputButton>
                </PromptInputTools>
                <PromptInputActions>
                    <PromptInputSubmit
                        canSubmit={canSubmit}
                        className={cn(isAgentDensity ? null : 'rounded-full')}
                        label="Start chat"
                        size="icon"
                        tooltip={getStartChatDisabledTooltip({
                            hasAgent: Boolean(agent),
                            runtimeReady: canSendToRuntime,
                            runtimeReason: runtimeDisabledReason,
                        })}
                    />
                </PromptInputActions>
            </PromptInputFooter>
        </PromptInput>
    );
}

function getStartChatDisabledTooltip({
    hasAgent,
    runtimeReady,
    runtimeReason,
}: {
    hasAgent: boolean;
    runtimeReady: boolean;
    runtimeReason: string;
}) {
    if (!hasAgent) {
        return 'Start Tavern Runtime to sync your agent.';
    }

    if (!runtimeReady) {
        return runtimeReason;
    }

    return undefined;
}
