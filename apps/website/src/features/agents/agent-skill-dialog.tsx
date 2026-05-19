import { Add01Icon } from '@hugeicons-pro/core-duotone-rounded';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogPanel,
    DialogTitle,
} from '../../components/ui/dialog.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import type { AgentListOutput, SkillListOutput } from '../../lib/trpc.tsx';
import { useAgentSkillsUpdate } from './use-agent-skills-update.ts';

export function AgentSkillDialog({
    agent,
    onOpenChange,
    open,
    skills,
}: {
    agent: AgentListOutput['agents'][number];
    onOpenChange: (open: boolean) => void;
    open: boolean;
    skills: SkillListOutput['skills'];
}) {
    const saveSkillsMutation = useAgentSkillsUpdate();
    const availableSkills = skills.filter((skill) => !agent.enabledSkillIds.includes(skill.id));

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add skill</DialogTitle>
                    <DialogDescription>
                        Add a runtime-visible skill to {agent.name}.
                    </DialogDescription>
                </DialogHeader>
                <DialogPanel className="grid gap-2">
                    {availableSkills.length === 0 ? (
                        <p className="rounded-xl border border-border border-dashed px-4 py-4 text-muted-foreground text-sm">
                            No unassigned runtime skills are available.
                        </p>
                    ) : (
                        availableSkills.map((skill) => (
                            <button
                                className="flex items-start gap-3 rounded-xl border border-border/70 px-4 py-3 text-left transition-colors hover:border-border-strong hover:bg-accent/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                disabled={saveSkillsMutation.isPending}
                                key={skill.id}
                                onClick={() => {
                                    saveSkillsMutation.mutate(
                                        {
                                            agentId: agent.id,
                                            enabledSkillIds: [...agent.enabledSkillIds, skill.id],
                                        },
                                        {
                                            onSuccess: () => onOpenChange(false),
                                        }
                                    );
                                }}
                                type="button"
                            >
                                <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-2">
                                        <span className="truncate font-medium text-foreground text-sm">
                                            {skill.name}
                                        </span>
                                    </span>
                                    <span className="mt-1 line-clamp-2 text-muted-foreground text-sm">
                                        {skill.description ?? skill.id}
                                    </span>
                                </span>
                                <Icon
                                    className="mt-1 size-4 text-muted-foreground"
                                    icon={Add01Icon}
                                />
                            </button>
                        ))
                    )}
                    {saveSkillsMutation.error ? (
                        <p className="text-error text-sm">{saveSkillsMutation.error.message}</p>
                    ) : null}
                </DialogPanel>
            </DialogContent>
        </Dialog>
    );
}
