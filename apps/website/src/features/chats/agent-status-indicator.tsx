import { useReducedMotion } from 'framer-motion';
import type { ChatActiveReply, ChatTurnFailure } from '../../hooks/chats/chat-timeline-state.ts';
import { cn } from '../../lib/utils.ts';
import { AgentEyes } from './agent-eyes.tsx';
import {
    type AgentStatusChatRow,
    getAgentStatusLabel,
    resolveAgentStatusExpression,
} from './agent-status-expression.ts';

interface AgentStatusIndicatorProps {
    activeReply: ChatActiveReply | null;
    className?: string;
    color?: string | null;
    failedTurn?: ChatTurnFailure | null;
    rows: AgentStatusChatRow[];
    size?: number;
}

export function AgentStatusIndicator({
    activeReply,
    className,
    color,
    failedTurn = null,
    rows,
    size = 32,
}: AgentStatusIndicatorProps) {
    const shouldReduceMotion = useReducedMotion();
    const emotion = resolveAgentStatusExpression({ activeReply, failedTurn, rows });
    const active = activeReply !== null || failedTurn !== null;

    return (
        <div
            className={cn('flex shrink-0 items-center justify-center overflow-visible', className)}
            style={{
                color: color ?? 'var(--foreground)',
                height: size,
                width: size,
            }}
        >
            <output
                aria-label={getAgentStatusLabel(emotion)}
                aria-live={active ? 'polite' : 'off'}
                className="flex h-full w-full shrink-0 items-center justify-center overflow-visible transition-colors duration-200 motion-reduce:transition-none"
            >
                <AgentEyes
                    aria-hidden={true}
                    blinking={!shouldReduceMotion}
                    className="overflow-visible"
                    color="currentColor"
                    emotion={emotion}
                    intensity={active ? 1 : 0.92}
                    size={size}
                    speed={shouldReduceMotion ? 0.35 : active ? 1.05 : 0.78}
                />
            </output>
        </div>
    );
}
