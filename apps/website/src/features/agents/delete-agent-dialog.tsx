import { AlertCircleIcon } from '@hugeicons/core-free-icons';
import { Alert, AlertDescription } from '../../components/ui/alert.tsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import type { AgentListOutput } from '../../lib/trpc.tsx';
import { useAgentDelete } from './use-agent-delete.ts';

interface DeleteAgentDialogProps {
    agent: AgentListOutput['agents'][number];
    onOpenChange: (open: boolean) => void;
    open: boolean;
}

export function DeleteAgentDialog({ agent, onOpenChange, open }: DeleteAgentDialogProps) {
    const deleteMutation = useAgentDelete();

    return (
        <Dialog
            onOpenChange={(nextOpen) => {
                onOpenChange(nextOpen);

                if (nextOpen) {
                    deleteMutation.reset();
                }
            }}
            open={open}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete agent?</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 px-6 pb-6">
                    <p className="text-muted-foreground text-sm leading-relaxed">
                        {`Delete "${agent.name}"? This removes the agent from Tavern Runtime and cannot be undone.`}
                    </p>
                    {deleteMutation.error ? (
                        <Alert variant="error">
                            <Icon icon={AlertCircleIcon} />
                            <AlertDescription>{deleteMutation.error.message}</AlertDescription>
                        </Alert>
                    ) : null}
                    <div className="flex justify-end gap-2">
                        <Button
                            disabled={deleteMutation.isPending}
                            onClick={() => onOpenChange(false)}
                            size="sm"
                            type="button"
                            variant="ghost"
                        >
                            Cancel
                        </Button>
                        <Button
                            loading={deleteMutation.isPending}
                            onClick={async () => {
                                await deleteMutation.mutateAsync({ agentId: agent.id });
                                onOpenChange(false);
                            }}
                            size="sm"
                            type="button"
                            variant="destructive"
                        >
                            Delete agent
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
