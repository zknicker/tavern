import { UsageModules } from '../overview/usage-modules.tsx';

export function Stats() {
    return (
        <div className="flex flex-1 flex-col gap-4 px-6 pt-5 pb-6">
            <div className="max-w-3xl">
                <h1 className="font-bold text-2xl text-foreground tracking-tight">Stats</h1>
                <p className="mt-2 text-base text-foreground/70 leading-relaxed">
                    Track Codex and OpenRouter usage without crowding the Home compose flow.
                </p>
            </div>

            <UsageModules />
        </div>
    );
}
