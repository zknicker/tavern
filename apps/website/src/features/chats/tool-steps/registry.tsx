import type { ReactNode } from 'react';
import { GenericToolStep } from './generic-tool-step.tsx';
import { ShellToolStep } from './shell-tool-step.tsx';
import type { ToolStepRendererProps } from './types.ts';

type ToolStepRenderer = (props: ToolStepRendererProps) => ReactNode;

const toolStepRenderers = {
    bash: ShellToolStep,
    command: ShellToolStep,
    exec: ShellToolStep,
    shell: ShellToolStep,
    zsh: ShellToolStep,
} satisfies Record<string, ToolStepRenderer>;

export function ToolStep(props: ToolStepRendererProps) {
    const Renderer = resolveToolStepRenderer(props.row.toolCall.name);
    return <Renderer {...props} />;
}

function resolveToolStepRenderer(name: string): ToolStepRenderer {
    const normalized = name.trim().toLowerCase();

    for (const [key, renderer] of Object.entries(toolStepRenderers)) {
        if (normalized === key || normalized.includes(key)) {
            return renderer;
        }
    }

    return GenericToolStep;
}
