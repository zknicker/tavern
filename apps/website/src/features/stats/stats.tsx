import { BadgeDivider } from '../../components/ui/badge-divider.tsx';
import { UsageModules } from '../overview/usage-modules.tsx';

export function Stats() {
    return (
        <div className="grid gap-10">
            <section>
                <BadgeDivider className="pb-4">Stats</BadgeDivider>
                <UsageModules />
            </section>
        </div>
    );
}
