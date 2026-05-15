import { BadgeDivider } from '../../components/ui/badge-divider.tsx';
import { Card } from '../../components/ui/card.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';

export function MissingCronJobCard({ onBack }: { onBack: () => void }) {
    return (
        <Card className="overflow-hidden">
            <BadgeDivider
                className="px-4 pt-5 pb-4"
                subtext="The requested automation could not be found in the current synced data."
            >
                Automation not found
            </BadgeDivider>
            <div className="flex items-center justify-between gap-4 p-4">
                <p className="text-muted-foreground text-sm">
                    Refresh the list or go back to automations and choose another automation.
                </p>
                <Button onClick={onBack} type="button" variant="secondary">
                    Back to automations
                </Button>
            </div>
        </Card>
    );
}
