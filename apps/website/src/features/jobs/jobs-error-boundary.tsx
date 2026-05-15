import * as React from 'react';
import { Card, CardContent } from '../../components/ui/card.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';

interface JobsErrorBoundaryProps {
    children: React.ReactNode;
    onRetry: () => void;
}

interface JobsErrorBoundaryState {
    error: Error | null;
}

// biome-ignore lint/style/useReactFunctionComponents: React error boundaries require class components here.
export class JobsErrorBoundary extends React.Component<
    JobsErrorBoundaryProps,
    JobsErrorBoundaryState
> {
    override state: JobsErrorBoundaryState = {
        error: null,
    };

    static getDerivedStateFromError(error: Error): JobsErrorBoundaryState {
        return {
            error,
        };
    }

    override render() {
        if (this.state.error) {
            return (
                <div className="flex flex-1 items-center justify-center p-6">
                    <Card className="max-w-md">
                        <CardContent className="p-6 text-center">
                            <p className="font-medium text-foreground">Jobs are unavailable</p>
                            <p className="mt-2 text-muted-foreground text-sm">
                                {this.state.error.message}
                            </p>
                            <div className="mt-4 flex justify-center">
                                <Button
                                    onClick={() => {
                                        this.props.onRetry();
                                        this.setState({ error: null });
                                    }}
                                    type="button"
                                    variant="secondary"
                                >
                                    Retry
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}
