import { useReducedMotion } from 'framer-motion';
import { useResolvedThemeOptional } from '../../components/theme-provider.tsx';
import type { ChatActiveReply, ChatTurnFailure } from '../../hooks/chats/chat-timeline-state.ts';
import { cn } from '../../lib/utils.ts';
import { AgentFace, type HeadName } from './agent-face.tsx';
import {
    type AgentStatusChatRow,
    getAgentStatusLabel,
    resolveAgentStatusExpression,
} from './agent-status-expression.ts';

const faceStyle = { flexShrink: 0, overflow: 'visible' } as const;

interface AgentStatusIndicatorProps {
    activeReply: ChatActiveReply | null;
    character: HeadName;
    className?: string;
    failedTurn?: ChatTurnFailure | null;
    rows: AgentStatusChatRow[];
    size?: number;
}

export function AgentStatusIndicator({
    activeReply,
    character,
    className,
    failedTurn = null,
    rows,
    size = 32,
}: AgentStatusIndicatorProps) {
    const shouldReduceMotion = useReducedMotion();
    const dark = useResolvedThemeOptional() === 'dark';
    const emotion = resolveAgentStatusExpression({ activeReply, failedTurn, rows });
    const active = activeReply !== null || failedTurn !== null;

    return (
        <div
            className={cn('flex shrink-0 items-center justify-center overflow-visible', className)}
            style={{ height: size, width: size }}
        >
            <output
                aria-label={getAgentStatusLabel(emotion)}
                aria-live={active ? 'polite' : 'off'}
                className="flex h-full w-full shrink-0 items-center justify-center overflow-visible"
            >
                <AgentFace
                    blinking={!shouldReduceMotion}
                    dark={dark}
                    emotion={emotion}
                    head={character}
                    intensity={active ? 1 : 0.92}
                    size={size}
                    speed={shouldReduceMotion ? 0.35 : active ? 1.05 : 0.78}
                    style={faceStyle}
                />
            </output>
        </div>
    );
}
