import * as React from 'react';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Textarea } from '../../components/ui/textarea.tsx';
import { usePrimaryAgent } from '../../hooks/agents/use-agent-list.ts';
import { useChatDraftLaunch } from '../../hooks/chats/use-chat-draft-launch.ts';
import { runtimeUnhealthyTooltip, useCapability } from '../../hooks/connections/use-capability.ts';
import type { CortexPageDetail } from './types.ts';

/**
 * Action panel for wiki follow-ups parked on the user (llm-wiki convention:
 * `status: proposed` + `owner: user`). The user types their call and it
 * launches an agent chat that applies the decision to the wiki.
 */
export function CortexFollowUpPanel({ page }: { page: CortexPageDetail }) {
    const primaryAgentQuery = usePrimaryAgent();
    const launchChatDraft = useChatDraftLaunch();
    const gatewayCapability = useCapability('gateway');
    const [decision, setDecision] = React.useState('');

    if (!isUserOwnedFollowUp(page)) {
        return null;
    }

    const agent = primaryAgentQuery.data?.agent ?? null;
    const nextAction = readFrontmatterString(page.frontmatter.next_action);
    const canSend = decision.trim().length > 0 && agent !== null && gatewayCapability.healthy;

    function handleSend() {
        if (!(agent && canSend)) {
            return;
        }
        launchChatDraft({
            agentId: agent.id,
            content: buildFollowUpPrompt({ decision: decision.trim(), nextAction, page }),
        });
    }

    return (
        <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4">
            <p className="font-medium text-foreground text-sm">
                This wiki follow-up is waiting on your call.
            </p>
            {nextAction ? <p className="mt-1 text-muted-foreground text-sm">{nextAction}</p> : null}
            <Textarea
                className="mt-3"
                onChange={(event) => setDecision(event.target.value)}
                placeholder="Type your decision — the agent will apply it to the wiki."
                rows={2}
                value={decision}
            />
            <div className="mt-2 flex justify-end">
                <Button
                    disabled={!canSend}
                    onClick={handleSend}
                    size="sm"
                    title={gatewayCapability.healthy ? 'Send to agent' : runtimeUnhealthyTooltip}
                    type="button"
                >
                    Send to agent
                </Button>
            </div>
        </div>
    );
}

function isUserOwnedFollowUp(page: CortexPageDetail) {
    return (
        page.section === 'inventory' &&
        readFrontmatterString(page.frontmatter.status)?.toLowerCase() === 'proposed' &&
        readFrontmatterString(page.frontmatter.owner)?.toLowerCase() === 'user'
    );
}

function buildFollowUpPrompt(input: {
    decision: string;
    nextAction: null | string;
    page: CortexPageDetail;
}) {
    return [
        `Wiki follow-up in the ${input.page.topic} topic wiki (${input.page.path}): ${input.page.title}.`,
        input.nextAction ? `Next action: ${input.nextAction}` : null,
        `My decision: ${input.decision}`,
        '',
        "Use the wiki skill to apply this: update the affected articles and the inventory record's status, set verified or owner fields as appropriate, and append log.md entries.",
    ]
        .filter((line) => line !== null)
        .join('\n');
}

function readFrontmatterString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}
