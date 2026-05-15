import { Trash2 } from '@hugeicons/core-free-icons';
import * as React from 'react';
import { Badge } from '../../../components/ui/badge.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import { SettingsItem } from '../../../components/ui/settings-row.tsx';

export function MessagingPlatformChannelList({
    channelIds,
    disabled,
    onChange,
    showEmpty = true,
}: {
    channelIds: string[];
    disabled: boolean;
    onChange: (channelIds: string[]) => void;
    showEmpty?: boolean;
}) {
    function removeChannel(index: number) {
        onChange(channelIds.filter((_, currentIndex) => currentIndex !== index));
    }

    return channelIds.length > 0 ? (
        channelIds.map((channelId, index) => (
            <React.Fragment key={channelId || `new-channel-${index}`}>
                {index > 0 ? <Separator /> : null}
                <SettingsItem className="py-2">
                    <div className="grid min-w-0 grid-cols-[1fr_auto] items-center gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                            <Badge size="sm" variant="subtle">
                                Channel ID
                            </Badge>
                            <div className="min-w-0 truncate font-mono text-muted-foreground text-sm">
                                {channelId}
                            </div>
                        </div>
                        <Button
                            aria-label={`Delete channel ${channelId || 'new channel'}`}
                            className="-mr-3"
                            disabled={disabled}
                            onClick={() => removeChannel(index)}
                            size="icon"
                            type="button"
                            variant="destructive-ghost"
                        >
                            <Icon icon={Trash2} />
                        </Button>
                    </div>
                </SettingsItem>
            </React.Fragment>
        ))
    ) : showEmpty ? (
        <SettingsItem className="py-5 text-center text-muted-foreground text-sm">
            All channels allowed
        </SettingsItem>
    ) : null;
}
