import { type ChatTurnProgressStep, initialPlanningStep } from './chat-timeline-types.ts';

export function mergeProgressSteps(
    current: ChatTurnProgressStep[],
    incoming: ChatTurnProgressStep[]
): ChatTurnProgressStep[] {
    const hasConcreteIncomingStep = incoming.some((step) => step.id !== initialPlanningStep.id);
    let next = hasConcreteIncomingStep
        ? current.filter((step) => step.id !== initialPlanningStep.id)
        : current;

    for (const step of incoming) {
        const existingIndex = next.findIndex((candidate) => candidate.id === step.id);

        next =
            existingIndex >= 0
                ? next.map((candidate, index) =>
                      index === existingIndex ? mergeProgressStep(candidate, step) : candidate
                  )
                : [...next, step];
    }

    return next;
}

export function areSameProgressSteps(left: ChatTurnProgressStep[], right: ChatTurnProgressStep[]) {
    return (
        left.length === right.length &&
        left.every((step, index) => {
            const candidate = right[index];

            return (
                candidate?.id === step.id &&
                candidate.kind === step.kind &&
                candidate.label === step.label &&
                candidate.status === step.status &&
                (candidate.detail ?? null) === (step.detail ?? null)
            );
        })
    );
}

export function completeProgressSteps(steps: ChatTurnProgressStep[]) {
    return steps.map((step) =>
        step.status === 'active' ? { ...step, status: 'completed' as const } : step
    );
}

function mergeProgressStep(
    current: ChatTurnProgressStep,
    incoming: ChatTurnProgressStep
): ChatTurnProgressStep {
    if (getProgressStatusRank(current.status) > getProgressStatusRank(incoming.status)) {
        return current;
    }

    return incoming;
}

function getProgressStatusRank(status: ChatTurnProgressStep['status']) {
    switch (status) {
        case 'failed':
            return 2;
        case 'completed':
            return 1;
        case 'active':
            return 0;
    }
}
