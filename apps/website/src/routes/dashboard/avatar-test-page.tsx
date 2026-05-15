import { AgentAvatar, type AvatarEmote } from '@tavern/agent-avatars';
import * as React from 'react';

const EMOTES: AvatarEmote[] = ['idle', 'happy', 'focused', 'surprised', 'sleepy'];

const SAMPLE_AGENTS = [
    { name: 'Atlas', color: '#e57373', avatar: 'A' },
    { name: 'Nova', color: '#2563eb', avatar: 'N' },
    { name: 'Memory', color: '#f59e0b', avatar: 'M' },
    { name: 'Echo', color: '#0ea5e9', avatar: 'E' },
    { name: 'Sage', color: '#10b981', avatar: 'S' },
    { name: 'Flare', color: '#ec4899', avatar: 'F' },
];

export function AvatarTestPage() {
    const [globalEmote, setGlobalEmote] = React.useState<AvatarEmote>('idle');
    const [active, setActive] = React.useState(false);

    return (
        <div className="mx-auto max-w-3xl space-y-10 p-8">
            <div>
                <h1 className="mb-1 font-semibold text-lg">Avatar Emotes</h1>
                <p className="text-muted-foreground text-sm">
                    Click an emote to smoothly transition all avatars. Watch the eyes lerp between
                    states.
                </p>
            </div>

            {/* Emote selector */}
            <div className="flex flex-wrap gap-2">
                {EMOTES.map((e) => (
                    <button
                        className={`rounded-md border px-3 py-1.5 font-mono text-sm transition-colors ${
                            globalEmote === e
                                ? 'border-foreground bg-foreground text-background'
                                : 'border-border hover:bg-muted'
                        }`}
                        key={e}
                        onClick={() => setGlobalEmote(e)}
                        type="button"
                    >
                        {e}
                    </button>
                ))}
                <button
                    className={`ml-4 rounded-md border px-3 py-1.5 font-mono text-sm transition-colors ${
                        active
                            ? 'border-green-500 bg-green-500/15 text-green-400'
                            : 'border-border hover:bg-muted'
                    }`}
                    onClick={() => setActive((a) => !a)}
                    type="button"
                >
                    {active ? 'active' : 'inactive'}
                </button>
            </div>

            {/* Avatar grid */}
            <div className="grid grid-cols-6 gap-6">
                {SAMPLE_AGENTS.map((agent) => (
                    <div className="flex flex-col items-center gap-2" key={agent.name}>
                        <AgentAvatar
                            active={active}
                            avatar={agent.avatar}
                            backgroundColor={agent.color}
                            className="size-16"
                            emote={globalEmote}
                            name={agent.name}
                        />
                        <span className="text-muted-foreground text-xs">{agent.name}</span>
                    </div>
                ))}
            </div>

            {/* Per-emote row — one avatar per emote for comparison */}
            <div>
                <h2 className="mb-3 font-medium text-sm">All emotes side-by-side</h2>
                <div className="flex gap-6">
                    {EMOTES.map((e) => (
                        <div className="flex flex-col items-center gap-2" key={e}>
                            <AgentAvatar
                                avatar="A"
                                backgroundColor="#2563eb"
                                className="size-16"
                                emote={e}
                                name={`compare-${e}`}
                            />
                            <span className="font-mono text-muted-foreground text-xs">{e}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Size variants */}
            <div>
                <h2 className="mb-3 font-medium text-sm">Size variants</h2>
                <div className="flex items-end gap-6">
                    {['size-8', 'size-10', 'size-12', 'size-16', 'size-20', 'size-24'].map(
                        (sizeClass) => (
                            <div className="flex flex-col items-center gap-2" key={sizeClass}>
                                <AgentAvatar
                                    avatar="X"
                                    backgroundColor="#e57373"
                                    className={sizeClass}
                                    emote={globalEmote}
                                    name={`size-${sizeClass}`}
                                />
                                <span className="font-mono text-muted-foreground text-xs">
                                    {sizeClass}
                                </span>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
