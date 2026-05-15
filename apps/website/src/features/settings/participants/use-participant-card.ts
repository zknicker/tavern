import * as React from 'react';
import type { ParticipantListOutput } from '../../../lib/trpc.tsx';

const debounceMs = 600;

interface UseParticipantCardOptions {
    onSave: (input: {
        avatar: string | null;
        displayName: string | null;
        primaryColor: string | null;
    }) => void;
    profile: ParticipantListOutput['profile'];
}

export function useParticipantCard({ onSave, profile }: UseParticipantCardOptions) {
    const [avatar, setAvatar] = React.useState(profile.avatar ?? '');
    const [displayName, setDisplayName] = React.useState(profile.displayName ?? '');
    const [primaryColor, setPrimaryColor] = React.useState(profile.primaryColor || '#64748b');
    const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    React.useEffect(() => {
        setAvatar(profile.avatar ?? '');
        setDisplayName(profile.displayName ?? '');
        setPrimaryColor(profile.primaryColor || '#64748b');
    }, [profile]);

    const save = React.useCallback(
        (next: { avatar: string; displayName: string; primaryColor: string }) => {
            onSave({
                avatar: next.avatar.trim() || null,
                displayName: next.displayName.trim() || null,
                primaryColor:
                    next.primaryColor.toLowerCase() === '#64748b' ? null : next.primaryColor,
            });
        },
        [onSave]
    );

    const debouncedSave = React.useCallback(
        (next: { avatar: string; displayName: string; primaryColor: string }) => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }

            debounceRef.current = setTimeout(() => save(next), debounceMs);
        },
        [save]
    );

    React.useEffect(() => {
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, []);

    const handleAvatarChange = React.useCallback(
        (value: string) => {
            setAvatar(value);
            debouncedSave({
                avatar: value,
                displayName,
                primaryColor,
            });
        },
        [debouncedSave, displayName, primaryColor]
    );

    const handleNameChange = React.useCallback(
        (value: string) => {
            setDisplayName(value);
            debouncedSave({
                avatar,
                displayName: value,
                primaryColor,
            });
        },
        [avatar, debouncedSave, primaryColor]
    );

    const handleColorChange = React.useCallback(
        (color: string) => {
            setPrimaryColor(color);

            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }

            save({
                avatar,
                displayName,
                primaryColor: color,
            });
        },
        [avatar, displayName, save]
    );

    return {
        avatar,
        displayName,
        handleAvatarChange,
        handleColorChange,
        handleNameChange,
        primaryColor,
    };
}
