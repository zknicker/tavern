import { useState } from 'react';
import { cn } from '../../lib/utils.ts';
import { AgentFace, EMOTIONS, type Emotion, HEAD_KINDS, type HeadName } from './agent-face.tsx';

// Dev hack page (/design/faces): every agent character across every facial
// expression, so avatar art + emotion poses can be reviewed on real pixels.
// Toggles cover the two things worth eyeballing while authoring — live motion
// (breathing, blinks, gaze wander) and the eye-alignment guide overlay.
const heads = HEAD_KINDS.filter((head): head is Exclude<HeadName, 'none'> => head !== 'none');
// every emotion except the utility `blink` frame (it only fires mid-animation)
const emotions = EMOTIONS.filter((emotion) => emotion !== 'blink');

export function AgentFacesDemo() {
    const [animate, setAnimate] = useState(true);
    const [guide, setGuide] = useState(false);

    return (
        <div className="relative flex-1 overflow-y-auto overflow-x-hidden">
            <div className="w-full max-w-5xl px-10 pt-8 pb-24">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <h1 className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest">
                        Agent faces
                    </h1>
                    <div className="flex items-center gap-4">
                        <Toggle checked={animate} label="Animate" onChange={setAnimate} />
                        <Toggle checked={guide} label="Guide" onChange={setGuide} />
                    </div>
                </div>

                <p className="mt-4 max-w-[60ch] text-muted-foreground text-sm">
                    Each character across the full expression set. Faces overflow their box on
                    purpose — plumes, ears, and points spill past the frame.
                </p>

                <div className="mt-10 flex flex-wrap gap-8">
                    {heads.map((head) => (
                        <div className="flex flex-col items-center gap-2" key={head}>
                            <AgentFace animate={animate} guide={guide} head={head} size={132} />
                            <span className="text-muted-foreground text-xs capitalize">{head}</span>
                        </div>
                    ))}
                </div>

                <div className="mt-14 flex flex-col gap-2">
                    {emotions.map((emotion) => (
                        <EmotionRow
                            animate={animate}
                            emotion={emotion}
                            guide={guide}
                            key={emotion}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

function EmotionRow({
    animate,
    emotion,
    guide,
}: {
    animate: boolean;
    emotion: Emotion;
    guide: boolean;
}) {
    return (
        <div className="flex items-center gap-6 border-border/60 border-b py-3 last:border-b-0">
            <span className="w-20 shrink-0 font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
                {emotion}
            </span>
            <div className="flex flex-1 flex-wrap items-center gap-6">
                {heads.map((head) => (
                    <AgentFace
                        animate={animate}
                        emotion={emotion}
                        guide={guide}
                        head={head}
                        key={head}
                        size={92}
                    />
                ))}
            </div>
        </div>
    );
}

function Toggle({
    checked,
    label,
    onChange,
}: {
    checked: boolean;
    label: string;
    onChange: (next: boolean) => void;
}) {
    return (
        <label className="flex cursor-pointer select-none items-center gap-2 text-muted-foreground text-xs">
            <input
                checked={checked}
                className={cn(
                    'size-3.5 rounded-sm border border-input accent-brand',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                )}
                onChange={(event) => onChange(event.target.checked)}
                type="checkbox"
            />
            {label}
        </label>
    );
}
