import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { ModelAccessSettings } from './model-access.tsx';

export function ModelAccessSection() {
    return (
        <div>
            <BadgeDivider className="pb-4" subtext="API keys and credentials.">
                Model Providers
            </BadgeDivider>
            <ModelAccessSettings />
        </div>
    );
}
