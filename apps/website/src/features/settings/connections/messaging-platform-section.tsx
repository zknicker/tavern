import * as React from 'react';
import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { usePrimaryAgent } from '../../../hooks/agents/use-agent-list.ts';
import type { RuntimeConnectionStatus } from '../../../hooks/connections/use-runtime-connection.ts';
import type { AgentListOutput } from '../../../lib/trpc.tsx';
import { useOpenClawMessagingPlatformDraft } from '../openclaw-draft/use-messaging-platform-draft.ts';
import { MessagingPlatformDetail } from './messaging-platform-detail.tsx';
import {
    buildDiscordBindingSaveInput,
    buildEmptyBindingDraft,
    formatCommaSeparatedIds,
    type MessagingBinding,
} from './messaging-platform-shared.ts';

function buildDraftFromBinding(binding: MessagingBinding) {
    return {
        accountId: binding.accountId,
        allowBots: binding.allowBots,
        agentId: binding.agentId,
        dmUserIds: formatCommaSeparatedIds(binding.match.dmUserIds),
        enabled: binding.enabled,
        groupPolicy: binding.groupPolicy,
        guilds: binding.guilds.map((guild) => ({ ...guild, draftKey: guild.id })),
        id: binding.id,
        inboundMode: binding.inboundMode,
        mentionPatterns: formatCommaSeparatedIds(binding.mentionPatterns),
        metadata: binding.metadata,
        parentChannelIds: formatCommaSeparatedIds(binding.match.parentChannelIds),
        replyToMode: binding.replyToMode,
        token: '',
        tokenConfigured: binding.tokenConfigured,
        tokenSource: binding.tokenSource,
    };
}

function buildAgentOptions(agent: AgentListOutput['agents'][number] | null | undefined) {
    return agent
        ? [
              {
                  avatar: agent.name,
                  color: agent.effectivePrimaryColor,
                  idLabel: agent.id,
                  summary: `Workspace ${agent.id}`,
                  title: agent.name,
                  value: agent.id,
              },
          ]
        : [];
}

export function MessagingPlatformsSection({
    agentId,
    runtimeStatus,
    subtext,
    title = 'Messaging Platforms',
}: {
    agentId?: string;
    runtimeStatus: RuntimeConnectionStatus;
    subtext?: string;
    title?: string;
}) {
    const primaryAgentQuery = usePrimaryAgent();
    const agentOptions = React.useMemo(
        () => buildAgentOptions(primaryAgentQuery.data?.agent),
        [primaryAgentQuery.data?.agent]
    );
    const { bindings, deleteBinding, hasConfig, isLoading, isSaving, saveBinding } =
        useOpenClawMessagingPlatformDraft();
    const [bindingDraft, setBindingDraft] = React.useState(() =>
        buildScopedEmptyBindingDraft(agentOptions, agentId)
    );
    const [drawerOpen, setDrawerOpen] = React.useState(false);
    const isRuntimeAvailable = runtimeStatus === 'reachable';
    const canEditBindings = isRuntimeAvailable && hasConfig;
    const discordBindings = React.useMemo(
        () =>
            bindings.filter(
                (binding) =>
                    binding.platform === 'discord' && (!agentId || binding.agentId === agentId)
            ),
        [agentId, bindings]
    );

    const openNewBinding = React.useCallback(() => {
        setBindingDraft(buildScopedEmptyBindingDraft(agentOptions, agentId));
        setDrawerOpen(true);
    }, [agentId, agentOptions]);

    const openEditBinding = React.useCallback((binding: MessagingBinding) => {
        setBindingDraft(buildDraftFromBinding(binding));
        setDrawerOpen(true);
    }, []);

    const updateBinding = React.useCallback(async () => {
        saveBinding(buildDiscordBindingSaveInput(bindingDraft, agentOptions));
        setDrawerOpen(false);
    }, [agentOptions, bindingDraft, saveBinding]);

    const removeBinding = React.useCallback(
        async (bindingId: string) => {
            deleteBinding(bindingId);
        },
        [deleteBinding]
    );

    return (
        <div>
            <BadgeDivider className="pb-4" subtext={subtext}>
                {title}
            </BadgeDivider>
            <MessagingPlatformDetail
                agentOptions={agentOptions}
                bindingDraft={bindingDraft}
                bindings={discordBindings}
                deleteBinding={removeBinding}
                deletePending={isSaving}
                drawerOpen={drawerOpen}
                isAgentRuntimeAvailable={canEditBindings}
                isLoading={isLoading || primaryAgentQuery.isLoading}
                onDraftChange={setBindingDraft}
                onDrawerOpenChange={setDrawerOpen}
                onEditBinding={openEditBinding}
                onNewBinding={openNewBinding}
                saveBinding={updateBinding}
                savePending={isSaving}
                showAgentField={false}
            />
            {!isRuntimeAvailable && (
                <p className="mt-3 text-muted-foreground text-sm">
                    Start Tavern Runtime before managing platform bindings.
                </p>
            )}
            {isRuntimeAvailable && !hasConfig && !isLoading ? (
                <p className="mt-3 text-muted-foreground text-sm">
                    OpenClaw config has not synced yet. Wait for config sync before managing
                    platform bindings.
                </p>
            ) : null}
        </div>
    );
}

function buildScopedEmptyBindingDraft(
    agentOptions: ReturnType<typeof buildAgentOptions>,
    agentId: string | undefined
) {
    const draft = buildEmptyBindingDraft(agentOptions);
    return agentId ? { ...draft, agentId } : draft;
}
