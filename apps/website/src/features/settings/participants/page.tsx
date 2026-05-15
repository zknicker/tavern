import * as React from 'react';
import { Card, CardFrame } from '../../../components/ui/card.tsx';
import { Skeleton } from '../../../components/ui/skeleton.tsx';
import { ParticipantProfile } from './participant-profile.tsx';

export function ParticipantsSettings() {
    return (
        <React.Suspense fallback={<ParticipantSettingsLoadingState />}>
            <ParticipantProfile />
        </React.Suspense>
    );
}

export function ParticipantSettingsLoadingState() {
    return (
        <div className="grid gap-10">
            <CardFrame>
                <Card className="overflow-hidden p-0">
                    <Skeleton className="h-16 rounded-none" />
                    <Skeleton className="h-16 rounded-none" />
                    <Skeleton className="h-16 rounded-none" />
                </Card>
            </CardFrame>
        </div>
    );
}
