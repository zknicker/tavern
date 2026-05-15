import { AgentAvatar } from '@tavern/agent-avatars';
import * as React from 'react';
import { Badge } from '../../../components/ui/badge.tsx';
import { Card, CardFrame } from '../../../components/ui/card.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import { SettingsRow } from '../../../components/ui/settings-row.tsx';
import type { ParticipantListOutput } from '../../../lib/trpc.tsx';

interface ObservedParticipantListProps {
    isPending: boolean;
    onLink: (participantId: string) => void;
    participants: ParticipantListOutput['participants'];
}

export function ObservedParticipantList({
    isPending,
    onLink,
    participants,
}: ObservedParticipantListProps) {
    if (participants.length === 0) {
        return (
            <CardFrame>
                <Card className="overflow-hidden p-0">
                    <div className="px-5 py-4 text-muted-foreground text-sm">
                        No external identities observed yet.
                    </div>
                </Card>
            </CardFrame>
        );
    }

    return (
        <CardFrame>
            <Card className="overflow-hidden p-0">
                {participants.map((participant, index) => (
                    <React.Fragment key={participant.id}>
                        {index > 0 ? <Separator /> : null}
                        <SettingsRow
                            description={
                                <ObservedParticipantBadges
                                    labels={participant.labels}
                                    participantId={participant.id}
                                    provider={participant.provider}
                                />
                            }
                            title={
                                <span className="flex min-w-0 items-center gap-2">
                                    <AgentAvatar
                                        avatar={participant.avatar}
                                        backgroundColor={participant.primaryColor ?? '#64748b'}
                                        className="size-7 shrink-0"
                                        name={participant.name}
                                    />
                                    <span className="truncate">{participant.name}</span>
                                </span>
                            }
                        >
                            <div className="flex justify-start md:justify-end">
                                <Button
                                    loading={isPending}
                                    onClick={() => onLink(participant.id)}
                                    size="sm"
                                    type="button"
                                    variant="secondary"
                                >
                                    Link
                                </Button>
                            </div>
                        </SettingsRow>
                    </React.Fragment>
                ))}
            </Card>
        </CardFrame>
    );
}

function ObservedParticipantBadges({
    labels,
    participantId,
    provider,
}: {
    labels: string[];
    participantId: string;
    provider: string;
}) {
    if (!provider && labels.length === 0) {
        return <span className="text-meta text-muted-foreground">No labels</span>;
    }

    return (
        <span className="flex flex-wrap gap-1.5">
            <Badge key={`${participantId}:provider:${provider}`} size="sm" variant="secondary">
                {provider}
            </Badge>
            {labels.map((label) => (
                <Badge key={`${participantId}:label:${label}`} size="sm" variant="secondary">
                    {label}
                </Badge>
            ))}
        </span>
    );
}
