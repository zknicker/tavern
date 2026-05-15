import { z } from 'zod';
import { listParticipants, type Participant } from '../storage/participants.ts';
import {
    resolveParticipantAvatar,
    resolveParticipantColor,
    resolveParticipantName,
} from './presentation.ts';
import { ensureSelfProfile, saveSelfProfile } from './self.ts';

const hexColorPattern = /^#[0-9a-f]{6}$/i;

export const participantDisplayNameSchema = z
    .string()
    .trim()
    .max(80)
    .nullable()
    .transform((value) => (value && value.length > 0 ? value : null));

export const participantAvatarSchema = z
    .string()
    .trim()
    .max(160)
    .nullable()
    .transform((value) => (value && value.length > 0 ? value : null));

export const participantPrimaryColorSchema = z
    .string()
    .trim()
    .regex(hexColorPattern, 'Use a 6-digit hex color.')
    .nullable()
    .transform((value) => (value && value.length > 0 ? value.toLowerCase() : null));

export function toParticipantCatalogItem(participant: Participant) {
    return {
        accountKey: participant.accountKey,
        avatar: resolveParticipantAvatar(participant),
        externalId: participant.externalId,
        id: participant.id,
        labels: participant.labels,
        linkedProfileId: participant.linkedProfile?.id ?? null,
        name: resolveParticipantName(participant),
        observedName: participant.observedName,
        primaryColor: resolveParticipantColor(participant),
        provider: participant.provider,
        updatedAt: participant.lastSeenAt,
    };
}

export async function listParticipantCatalog() {
    const [profile, participants] = await Promise.all([ensureSelfProfile(), listParticipants()]);

    if (!profile) {
        throw new Error('Failed to initialize the Tavern profile.');
    }

    return {
        participants: participants.map((participant) => toParticipantCatalogItem(participant)),
        profile: {
            avatar: profile.avatar?.trim() || null,
            displayName: profile.displayName?.trim() || null,
            id: profile.id,
            primaryColor: profile.primaryColor?.trim() || null,
        },
    };
}

export async function saveCatalogProfileSettings(input: {
    avatar: string | null;
    displayName: string | null;
    primaryColor: string | null;
}) {
    const profile = await saveSelfProfile(input);

    if (!profile) {
        throw new Error('Failed to save the Tavern profile.');
    }

    return {
        avatar: profile.avatar?.trim() || null,
        displayName: profile.displayName?.trim() || null,
        id: profile.id,
        primaryColor: profile.primaryColor?.trim() || null,
    };
}
