import * as React from 'react';
import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { usePrimaryAgent } from '../../../hooks/agents/use-agent-list.ts';
import type { RuntimeConnectionStatus } from '../../../hooks/connections/use-runtime-connection.ts';
import type { AgentListOutput } from '../../../lib/trpc.tsx';
import { MessagingPlatformDetail } from './messaging-platform-detail.tsx';
import {
    type BindingDraft,
    buildDiscordBindingSaveInput,
    buildEmptyBindingDraft,
    formatCommaSeparatedIds,
    type MessagingBinding,
} from './messaging-platform-shared.ts';
import { useMessagingPlatformBindings } from './use-messaging-platform-bindings.ts';

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
        useMessagingPlatformBindings();
    const [bindingDraft, setBindingDraft] = React.useState(() =>
        buildScopedEmptyBindingDraft(agentOptions, agentId)
    );
    const [drawerOpen, setDrawerOpen] = React.useState(false);
    const savedBindingDraftSignatureRef = React.useRef<string | null>(null);
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
        savedBindingDraftSignatureRef.current = null;
        setDrawerOpen(true);
    }, [agentId, agentOptions]);

    const openEditBinding = React.useCallback((binding: MessagingBinding) => {
        const draft = buildDraftFromBinding(binding);
        savedBindingDraftSignatureRef.current = buildBindingDraftSignature(draft);
        setBindingDraft(draft);
        setDrawerOpen(true);
    }, []);

    const updateBinding = React.useCallback(async () => {
        await saveBinding(buildDiscordBindingSaveInput(bindingDraft, agentOptions));
        savedBindingDraftSignatureRef.current = buildBindingDraftSignature(bindingDraft);
        setDrawerOpen(false);
    }, [agentOptions, bindingDraft, saveBinding]);
    const saveExistingBindingDraft = React.useCallback(async () => {
        if (!(bindingDraft.id && canSaveBindingDraft(bindingDraft, canEditBindings))) {
            return;
        }

        const signature = buildBindingDraftSignature(bindingDraft);

        if (signature === savedBindingDraftSignatureRef.current) {
            return;
        }

        const previousSignature = savedBindingDraftSignatureRef.current;
        savedBindingDraftSignatureRef.current = signature;

        try {
            await saveBinding(buildDiscordBindingSaveInput(bindingDraft, agentOptions));
        } catch (error) {
            savedBindingDraftSignatureRef.current = previousSignature;
            throw error;
        }
    }, [agentOptions, bindingDraft, canEditBindings, saveBinding]);

    const removeBinding = React.useCallback(
        async (bindingId: string) => {
            const binding = bindings.find((entry) => entry.id === bindingId);

            if (!binding) {
                return;
            }

            await deleteBinding({
                agentId: binding.agentId,
                bindingId,
            });
        },
        [bindings, deleteBinding]
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
                isAgentRuntimeAvailable={canEditBindings && !isSaving}
                isLoading={isLoading || primaryAgentQuery.isLoading}
                onDraftBlur={saveExistingBindingDraft}
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
                    Discord binding edits are not available in Tavern yet.
                </p>
            ) : null}
        </div>
    );
}

function canSaveBindingDraft(draft: BindingDraft, runtimeAvailable: boolean) {
    return Boolean(
        runtimeAvailable &&
            draft.agentId.trim() &&
            (draft.tokenConfigured || draft.token.trim()) &&
            draft.guilds.every(
                (guild) =>
                    guild.id.trim() &&
                    guild.channelIds.every((channelId) => channelId.trim().length > 0)
            )
    );
}

function buildBindingDraftSignature(draft: BindingDraft) {
    return JSON.stringify(buildStableBindingDraft(draft));
}

function buildStableBindingDraft(draft: BindingDraft) {
    return {
        accountId: draft.accountId,
        agentId: draft.agentId,
        allowBots: draft.allowBots,
        dmUserIds: draft.dmUserIds,
        enabled: draft.enabled,
        groupPolicy: draft.groupPolicy,
        guilds: draft.guilds.map(({ draftKey: _draftKey, ...guild }) => guild),
        id: draft.id,
        inboundMode: draft.inboundMode,
        mentionPatterns: draft.mentionPatterns,
        metadata: draft.metadata,
        parentChannelIds: draft.parentChannelIds,
        replyToMode: draft.replyToMode,
        token: draft.token,
        tokenConfigured: draft.tokenConfigured,
        tokenSource: draft.tokenSource,
    };
}

function buildScopedEmptyBindingDraft(
    agentOptions: ReturnType<typeof buildAgentOptions>,
    agentId: string | undefined
) {
    const draft = buildEmptyBindingDraft(agentOptions);
    return agentId ? { ...draft, agentId } : draft;
}
