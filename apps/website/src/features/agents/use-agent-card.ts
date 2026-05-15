import * as React from 'react';
import type { AgentListOutput } from '../../lib/trpc.tsx';

const debounceMs = 600;

interface UseAgentCardOptions {
    agent: AgentListOutput['agents'][number];
    onSave: (input: {
        agentId: string;
        displayName: string | null;
        primaryColor: string | null;
    }) => void;
}

export function useAgentCard({ agent, onSave }: UseAgentCardOptions) {
    const [displayName, setDisplayName] = React.useState(agent.name);
    const [primaryColor, setPrimaryColor] = React.useState(agent.effectivePrimaryColor);
    const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    React.useEffect(() => {
        setDisplayName(agent.name);
        setPrimaryColor(agent.effectivePrimaryColor);
    }, [agent.effectivePrimaryColor, agent.name]);

    const save = React.useCallback(
        (name: string, color: string) => {
            onSave({
                agentId: agent.id,
                displayName: name.trim() || null,
                primaryColor:
                    color.toLowerCase() === agent.defaultPrimaryColor.toLowerCase() ? null : color,
            });
        },
        [agent.defaultPrimaryColor, agent.id, onSave]
    );

    const debouncedSave = React.useCallback(
        (name: string, color: string) => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }

            debounceRef.current = setTimeout(() => save(name, color), debounceMs);
        },
        [save]
    );

    React.useEffect(() => {
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, []);

    const handleNameChange = React.useCallback(
        (value: string) => {
            setDisplayName(value);
            debouncedSave(value, primaryColor);
        },
        [debouncedSave, primaryColor]
    );

    const handleColorChange = React.useCallback(
        (color: string) => {
            setPrimaryColor(color);

            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }

            save(displayName, color);
        },
        [displayName, save]
    );

    return {
        displayName,
        handleColorChange,
        handleNameChange,
        primaryColor,
    };
}
