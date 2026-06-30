import * as React from 'react';
import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import { SettingsRow } from '../../../components/ui/settings-row.tsx';
import { useUserProfilePreference } from '../../../hooks/shell/use-user-profile-preference.ts';
import { readAvatarImage } from './resize-image.ts';

export function ProfileSettings() {
    const profile = useUserProfilePreference();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [error, setError] = React.useState<string | null>(null);
    const displayName = profile.displayName ?? '';

    const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file) {
            return;
        }

        setError(null);

        try {
            profile.setAvatar(await readAvatarImage(file));
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'That image could not be read.');
        }
    };

    return (
        <div className="space-y-8">
            <div>
                <BadgeDivider className="pb-3">Profile</BadgeDivider>
                <p className="pb-5 text-muted-foreground text-sm">
                    Your name and avatar as they appear next to your messages in chats.
                </p>
                <div className="overflow-hidden rounded-lg border border-border bg-card">
                    <SettingsRow
                        description="Shown next to your messages."
                        error={error}
                        title="Avatar"
                    >
                        <div className="flex items-center gap-3 md:justify-end">
                            <AvatarPreview avatarUrl={profile.avatarUrl} name={displayName} />
                            <input
                                accept="image/*"
                                className="hidden"
                                onChange={(event) => {
                                    void handleFile(event);
                                }}
                                ref={fileInputRef}
                                type="file"
                            />
                            <Button
                                onClick={() => fileInputRef.current?.click()}
                                size="sm"
                                variant="outline"
                            >
                                {profile.avatarUrl ? 'Change' : 'Upload'}
                            </Button>
                            {profile.avatarUrl ? (
                                <Button
                                    onClick={() => profile.setAvatar(null)}
                                    size="sm"
                                    variant="ghost"
                                >
                                    Remove
                                </Button>
                            ) : null}
                        </div>
                    </SettingsRow>
                    <div className="border-border border-t">
                        <SettingsRow description="Leave blank to show “You”." title="Display name">
                            <Input
                                onChange={(event) => profile.setDisplayName(event.target.value)}
                                placeholder="You"
                                value={displayName}
                            />
                        </SettingsRow>
                    </div>
                </div>
            </div>
        </div>
    );
}

function AvatarPreview({ avatarUrl, name }: { avatarUrl: string | null; name: string }) {
    if (avatarUrl) {
        return (
            <span className="inline-flex size-9 shrink-0 overflow-hidden rounded-full ring-1 ring-border/50">
                <img
                    alt="Your avatar"
                    className="size-full object-cover"
                    height={36}
                    src={avatarUrl}
                    width={36}
                />
            </span>
        );
    }

    return (
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground text-xs ring-1 ring-border/50">
            {getInitials(name)}
        </span>
    );
}

function getInitials(name: string) {
    const parts = name
        .trim()
        .split(/\s+/)
        .filter((part) => part.length > 0);

    if (parts.length === 0) {
        return 'You';
    }

    if (parts.length === 1) {
        return parts[0]?.slice(0, 2).toUpperCase() ?? 'You';
    }

    return `${parts[0]?.[0] ?? ''}${parts.at(-1)?.[0] ?? ''}`.toUpperCase();
}
