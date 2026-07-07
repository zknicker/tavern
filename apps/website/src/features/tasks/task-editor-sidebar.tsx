import type { ReactNode } from 'react';
import { Label } from '../../components/ui/primitives/label.tsx';
import { ScrollArea } from '../../components/ui/scroll-area.tsx';

export function TaskEditorSidebar({ children }: { children: ReactNode }) {
    return (
        <aside className="relative flex min-h-0 w-full flex-col border-border/70 border-t max-lg:max-h-[45dvh] max-lg:flex-none lg:w-[22rem] lg:border-t-0 lg:border-l-0 lg:before:absolute lg:before:inset-y-0 lg:before:left-0 lg:before:w-px lg:before:bg-gradient-to-t lg:before:from-border/70 lg:before:via-60% lg:before:via-border/70 lg:before:to-transparent lg:before:content-['']">
            <ScrollArea scrollbarGutter>
                <div className="flex flex-col gap-5 px-4 pt-4 pb-4">{children}</div>
            </ScrollArea>
        </aside>
    );
}

export function TaskEditorSection({ children, title }: { children: ReactNode; title: string }) {
    return (
        <section className="space-y-2">
            <Label className="font-medium text-muted-foreground text-sm">{title}</Label>
            {children}
        </section>
    );
}
