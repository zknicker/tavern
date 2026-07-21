import { AlertCircleIcon } from '@hugeicons/core-free-icons';
import { useResolvedThemeOptional } from '../../../components/theme-provider.tsx';
import { Alert, AlertDescription } from '../../../components/ui/alert.tsx';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../../../components/ui/dialog.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { useAgentSessionReset } from '../../../hooks/agents/use-agent-session.ts';
import type { AgentListOutput } from '../../../lib/trpc.tsx';
import { resolveAgentInk } from '../../agents/agent-color-presets.ts';
import { AgentFace } from '../../chats/agent-face.tsx';

export function RestartAgentDialog({
    agent,
    onOpenChange,
    open,
}: {
    agent: AgentListOutput['agents'][number];
    onOpenChange: (open: boolean) => void;
    open: boolean;
}) {
    const resetSession = useAgentSessionReset();
    const dark = useResolvedThemeOptional() === 'dark';

    return (
        <Dialog
            onOpenChange={(nextOpen) => {
                onOpenChange(nextOpen);
                if (nextOpen) {
                    resetSession.reset();
                }
            }}
            open={open}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Start a fresh session?</DialogTitle>
                    <DialogDescription>Confirm this agent-wide reset.</DialogDescription>
                </DialogHeader>
                <div className="mb-4 flex items-center gap-3">
                    <AgentFace
                        animate={false}
                        dark={dark}
                        head={agent.effectiveCharacter}
                        ink={resolveAgentInk(dark, agent.effectivePrimaryColor)}
                        size={36}
                    />
                    <p className="text-muted-foreground text-sm">
                        Start a fresh session for {agent.name}? The next turn begins with a clean
                        context; a turn already running finishes on the old session.
                    </p>
                </div>
                {resetSession.error ? (
                    <Alert variant="error">
                        <Icon icon={AlertCircleIcon} />
                        <AlertDescription>{resetSession.error.message}</AlertDescription>
                    </Alert>
                ) : null}
                <DialogFooter>
                    <Button
                        disabled={resetSession.isPending}
                        onClick={() => onOpenChange(false)}
                        variant="ghost"
                    >
                        Cancel
                    </Button>
                    <Button
                        loading={resetSession.isPending}
                        onClick={async () => {
                            await resetSession.mutateAsync({ agentId: agent.id, kind: 'session' });
                            onOpenChange(false);
                        }}
                    >
                        Start fresh
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
