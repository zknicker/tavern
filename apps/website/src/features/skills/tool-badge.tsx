import type { IconSvgElement } from '@hugeicons/react';
import {
    AiBrain01Icon,
    Book01Icon,
    BrowserIcon,
    CheckListIcon,
    File01Icon,
    FileEditIcon,
    Folder01Icon,
    GlobalSearchIcon,
    InternetIcon,
    MagicWand01Icon,
    PencilEdit01Icon,
    PlugIcon,
    Search01Icon,
    TerminalIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import { cn } from '../../lib/utils.ts';

const toolIconMap: Record<string, IconSvgElement> = {
    Agent: AiBrain01Icon,
    Bash: TerminalIcon,
    BashOutput: TerminalIcon,
    Browser: BrowserIcon,
    Edit: PencilEdit01Icon,
    Glob: Folder01Icon,
    Grep: Search01Icon,
    KillShell: TerminalIcon,
    NotebookEdit: Book01Icon,
    NotebookRead: Book01Icon,
    Read: File01Icon,
    Task: AiBrain01Icon,
    TodoRead: CheckListIcon,
    TodoWrite: CheckListIcon,
    WebFetch: InternetIcon,
    WebSearch: GlobalSearchIcon,
    Write: FileEditIcon,
};

function parseToolName(name: string): { icon: IconSvgElement; label: string } {
    const trimmed = name.trim();

    if (trimmed.startsWith('mcp__')) {
        const segments = trimmed.split('__').filter(Boolean);
        const server = segments[1] ?? trimmed;
        return { icon: PlugIcon, label: server };
    }

    const base = trimmed.split('(')[0]?.trim() ?? trimmed;
    return { icon: toolIconMap[base] ?? MagicWand01Icon, label: base };
}

export function ToolBadge({ className, name }: { className?: string; name: string }) {
    const { icon, label } = parseToolName(name);

    return (
        <span
            className={cn(
                'inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-card py-1 pr-2.5 pl-2 font-medium text-foreground text-sm shadow-xs',
                className
            )}
            title={name}
        >
            <Icon className="size-3.5 text-muted-foreground" icon={icon} />
            <span className="truncate">{label}</span>
        </span>
    );
}
