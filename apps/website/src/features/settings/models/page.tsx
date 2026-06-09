import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { ModelAccessSettings } from '../connections/model-access.tsx';
import { ModelInventorySection } from './model-inventory-section.tsx';

export function ModelsSettings() {
    return (
        <div className="grid gap-10">
            <ModelAccessSettings />

            <section>
                <BadgeDivider className="pb-4">Available Models</BadgeDivider>
                <ModelInventorySection />
            </section>
        </div>
    );
}
