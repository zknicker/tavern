import { toastManager } from '../../components/ui/toast.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

/**
 * Leading-slash composer commands: a submitted message that names a known
 * catalog command runs in the chat's session instead of starting a turn.
 * The run lands in the timeline as a durable command card; the only toast is
 * the error case where the command could not run at all.
 * See specs/composer-commands.md.
 */
export function useChatCommandRunner() {
    const utils = trpc.useUtils();
    const catalog = trpc.agent.commands.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
    const runCommand = trpc.agent.runCommand.useMutation();

    return {
        matchCommand(content: string) {
            return matchChatCommand(content, catalog.data?.commands ?? []);
        },
        async runCommand(input: { agentId: string; chatId: string; command: string }) {
            const name = input.command.split(/\s/u, 1)[0] ?? input.command;

            try {
                await runCommand.mutateAsync(input);
            } catch (error) {
                toastManager.add({
                    description: error instanceof Error ? error.message : 'Command failed.',
                    priority: 'high',
                    title: `${name} failed`,
                    type: 'error',
                });
                return;
            }

            await utils.chat.log.list.invalidate().catch(() => undefined);
        },
    };
}

export function matchChatCommand(
    content: string,
    commands: ReadonlyArray<{ name: string }>
): string | null {
    const match = /^\/[a-z0-9][a-z0-9_-]*(?=\s|$)/iu.exec(content.trim());

    if (!match) {
        return null;
    }

    const name = match[0].toLowerCase();
    return commands.some((command) => command.name.toLowerCase() === name) ? name : null;
}
