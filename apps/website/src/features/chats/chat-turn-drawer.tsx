import { useReducedMotion } from 'framer-motion';
import { useResolvedThemeOptional } from '../../components/theme-provider.tsx';
import {
    Drawer,
    DrawerDescription,
    DrawerHeader,
    DrawerPanel,
    DrawerPopup,
    DrawerTitle,
} from '../../components/ui/drawer.tsx';
import { formatShortTime, formatTimestamp } from '../../lib/format.ts';
import { resolveAgentInk } from '../agents/agent-color-presets.ts';
import { AgentFace, type HeadName } from './agent-face.tsx';
import { groupAgentItems } from './chat-transcript-item-utils.ts';
import { getItemTimestamp, type TranscriptTurnEntry } from './chat-transcript-model.ts';
import { AgentTurnSegment } from './chat-transcript-turn.tsx';

const faceStyle = { flexShrink: 0, overflow: 'visible' } as const;

/**
 * Full detail for one agent turn: every tool/work drawer, preamble and
 * intra-turn updates, and the streaming or final response. Opened from the
 * active status row — the transcript pane itself stays prose-only.
 */
export function ChatTurnDrawer({
    agentCharacter = null,
    agentColor = null,
    agentName,
    chatId,
    entry,
    onOpenChange,
    open,
    turnActive = false,
}: {
    agentCharacter?: HeadName | null;
    agentColor?: string | null;
    agentName: string;
    chatId?: string;
    entry: TranscriptTurnEntry | null;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    turnActive?: boolean;
}) {
    return (
        <Drawer onOpenChange={onOpenChange} open={open} position="right">
            <DrawerPopup
                className="w-[min(96vw,40rem)] max-w-[min(96vw,40rem)] overflow-hidden"
                showCloseButton
                variant="inset"
            >
                <ChatTurnDrawerHeader
                    agentCharacter={agentCharacter}
                    agentColor={agentColor}
                    agentName={agentName}
                    entry={entry}
                    turnActive={turnActive}
                />
                <DrawerPanel>
                    <ChatTurnBody chatId={chatId} entry={entry} turnActive={turnActive} />
                </DrawerPanel>
            </DrawerPopup>
        </Drawer>
    );
}

// The agent fronts their own turn: a large living face on a soft wash of
// their color, with the turn's when/how-long/what at a glance beneath the
// name.
function ChatTurnDrawerHeader({
    agentCharacter,
    agentColor,
    agentName,
    entry,
    turnActive,
}: {
    agentCharacter: HeadName | null;
    agentColor: string | null;
    agentName: string;
    entry: TranscriptTurnEntry | null;
    turnActive: boolean;
}) {
    const dark = useResolvedThemeOptional() === 'dark';
    const shouldReduceMotion = useReducedMotion();
    const startedAt = entry?.timestamp ?? null;
    const duration = turnActive ? null : formatTurnDuration(entry);
    const metaParts = turnActive
        ? [startedAt ? `started ${formatShortTime(startedAt)}` : null]
        : [formatTurnDayTime(startedAt), duration];

    return (
        <DrawerHeader className="gap-3">
            <div className="flex items-center gap-2.5">
                <div className="flex size-11 shrink-0 items-center justify-center">
                    <AgentFace
                        blinking={!shouldReduceMotion}
                        dark={dark}
                        head={agentCharacter ?? 'none'}
                        ink={resolveAgentInk(dark, agentColor)}
                        intensity={turnActive ? 1 : 0.92}
                        size={40}
                        speed={shouldReduceMotion ? 0.35 : turnActive ? 1.05 : 0.78}
                        style={faceStyle}
                    />
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                    <DrawerTitle className="truncate">{agentName}</DrawerTitle>
                    <DrawerDescription className="flex min-w-0 items-center gap-1.5">
                        {turnActive ? (
                            <span className="flex shrink-0 items-center gap-1.5">
                                <span aria-hidden className="relative flex size-2">
                                    <span className="absolute inline-flex size-full rounded-full bg-info opacity-60 motion-safe:animate-ping" />
                                    <span className="relative inline-flex size-2 rounded-full bg-info" />
                                </span>
                                Working now
                            </span>
                        ) : null}
                        <span className="truncate">
                            {metaParts.filter(Boolean).join(' · ') ||
                                (turnActive ? 'Getting started' : 'Turn detail')}
                        </span>
                    </DrawerDescription>
                </div>
            </div>
        </DrawerHeader>
    );
}

// The drawer's turn rendering, exported separately so it stays testable
// without the drawer's portal.
export function ChatTurnBody({
    chatId,
    entry,
    turnActive = false,
}: {
    chatId?: string;
    entry: TranscriptTurnEntry | null;
    turnActive?: boolean;
}) {
    const segments = entry ? groupAgentItems(entry.items) : [];

    if (segments.length === 0) {
        return <p className="text-muted-foreground text-sm">Nothing to show yet.</p>;
    }

    return (
        <div className="flex min-w-0 flex-col gap-3 pt-2 pb-2">
            {segments.map((segment, index) => (
                // Work groups draw their own card surface (header above,
                // rows on the card) via the 'card' activity appearance.
                <AgentTurnSegment
                    activityAppearance="card"
                    chatId={chatId}
                    defaultOpenWorkGroups
                    key={segment.key}
                    segment={segment}
                    turnActive={turnActive && index === segments.length - 1}
                    turnCompletedAt={null}
                    turnStartedAt={entry?.timestamp ?? null}
                    turnStopped={false}
                />
            ))}
        </div>
    );
}

// "Today at 10:52 am" / "Yesterday at 4:03 pm" / "Jun 12, 4:03 PM"
function formatTurnDayTime(timestamp: string | null) {
    if (!timestamp) {
        return null;
    }

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    const now = new Date();
    const startOfDay = (value: Date) =>
        new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
    const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

    if (dayDiff === 0) {
        return `Today at ${formatShortTime(timestamp)}`;
    }

    if (dayDiff === 1) {
        return `Yesterday at ${formatShortTime(timestamp)}`;
    }

    return formatTimestamp(timestamp);
}

// Wall-clock span from the turn's first to last item ("18s", "2m 05s").
function formatTurnDuration(entry: TranscriptTurnEntry | null) {
    if (!entry?.timestamp) {
        return null;
    }

    const start = Date.parse(entry.timestamp);
    let end = Number.NaN;

    for (let index = entry.items.length - 1; index >= 0; index -= 1) {
        const item = entry.items[index];
        const timestamp = item ? getItemTimestamp(item) : null;
        const parsed = timestamp ? Date.parse(timestamp) : Number.NaN;

        if (!Number.isNaN(parsed)) {
            end = parsed;
            break;
        }
    }

    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
        return null;
    }

    const totalSeconds = Math.round((end - start) / 1000);

    if (totalSeconds < 60) {
        return `${totalSeconds}s`;
    }

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}
