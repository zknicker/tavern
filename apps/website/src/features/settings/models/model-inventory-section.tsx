import { AlertCircleIcon } from '@hugeicons/core-free-icons';
import { Add01Icon } from '@hugeicons-pro/core-duotone-rounded';
import * as React from 'react';
import { Alert, AlertDescription } from '../../../components/ui/alert.tsx';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogPanel,
    DialogTitle,
} from '../../../components/ui/dialog.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Field, FieldLabel } from '../../../components/ui/primitives/field.tsx';
import { Form } from '../../../components/ui/primitives/form.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import { SearchInput } from '../../../components/ui/primitives/search-input.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../../components/ui/select.tsx';
import { Skeleton } from '../../../components/ui/skeleton.tsx';
import { useAddCatalogModel } from '../../../hooks/models/use-add-catalog-model.ts';
import { useDeleteCatalogModel } from '../../../hooks/models/use-delete-catalog-model.ts';
import { useModelInventory } from '../../../hooks/models/use-model-inventory.ts';
import { listModelProviderConfigs } from '../../../lib/model-provider-config.ts';
import type { ModelInventoryOutput } from '../../../lib/trpc.tsx';
import { InventoryModelCard } from './inventory-model-card.tsx';

export function ModelInventorySection() {
    const inventoryQuery = useModelInventory();
    const deleteMutation = useDeleteCatalogModel();
    const [search, setSearch] = React.useState('');
    const [addDialogOpen, setAddDialogOpen] = React.useState(false);

    if (inventoryQuery.isLoading) {
        return <ModelInventoryLoadingState />;
    }

    if (inventoryQuery.error) {
        return (
            <div className="pb-4">
                <Alert variant="error">
                    <Icon icon={AlertCircleIcon} />
                    <AlertDescription>{inventoryQuery.error.message}</AlertDescription>
                </Alert>
            </div>
        );
    }

    if (!inventoryQuery.data) {
        return null;
    }

    const flatModels = inventoryQuery.data.providers.flatMap((provider) =>
        provider.models
            .map((model) => ({
                ...model,
                providerId: provider.provider,
            }))
            .filter((model) => matchesSearch(model, search))
    );

    return (
        <div className="flex flex-col gap-4 pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <SearchInput
                    aria-label="Search models"
                    className="w-full flex-1"
                    name="model-search"
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Filter models..."
                    size="lg"
                    value={search}
                />
                <Button
                    className="w-full sm:w-auto"
                    onClick={() => setAddDialogOpen(true)}
                    size="lg"
                    type="button"
                    variant="secondary"
                >
                    <Icon aria-hidden="true" className="opacity-100" icon={Add01Icon} />
                    Add model
                </Button>
            </div>

            {deleteMutation.error?.message ? (
                <Alert variant="error">
                    <Icon icon={AlertCircleIcon} />
                    <AlertDescription>{deleteMutation.error.message}</AlertDescription>
                </Alert>
            ) : null}

            {flatModels.length > 0 ? (
                <ul className="grid list-none gap-3 p-0 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {flatModels.map((model) => (
                        <li key={model.ref}>
                            <InventoryModelCard
                                isDeleting={
                                    deleteMutation.isPending &&
                                    deleteMutation.variables?.modelRef === model.ref
                                }
                                model={model}
                                onDelete={() =>
                                    deleteMutation.mutate({
                                        modelRef: model.ref,
                                    })
                                }
                                providerId={model.providerId}
                            />
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="rounded-xl border border-border/55 border-dashed bg-muted/16 px-4 py-6 text-center text-muted-foreground text-sm">
                    No models match this search.
                </div>
            )}

            <AddCatalogModelDialog onOpenChange={setAddDialogOpen} open={addDialogOpen} />
        </div>
    );
}

function AddCatalogModelDialog({
    onOpenChange,
    open,
}: {
    onOpenChange: (open: boolean) => void;
    open: boolean;
}) {
    const addMutation = useAddCatalogModel();
    const providerOptions = listModelProviderConfigs();
    const [provider, setProvider] = React.useState(providerOptions[0]?.configName ?? 'codex');
    const [modelId, setModelId] = React.useState('');
    const trimmedModelId = modelId.trim();
    const canAdd = trimmedModelId.length > 0 && !addMutation.isPending;

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!canAdd) {
            return;
        }

        addMutation.mutate(
            {
                modelId: trimmedModelId,
                provider: provider as ModelInventoryOutput['providers'][number]['provider'],
            },
            {
                onSuccess: () => {
                    setModelId('');
                    onOpenChange(false);
                },
            }
        );
    };

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Model</DialogTitle>
                    <DialogDescription>
                        Add a provider model ID to the Tavern model catalog.
                    </DialogDescription>
                </DialogHeader>
                <Form className="contents" onSubmit={handleSubmit}>
                    <DialogPanel className="grid gap-4">
                        <Field>
                            <FieldLabel>Provider</FieldLabel>
                            <Select
                                onValueChange={(nextValue) => {
                                    if (nextValue) {
                                        setProvider(nextValue);
                                    }
                                }}
                                value={provider}
                            >
                                <SelectTrigger>
                                    <SelectValue>
                                        {
                                            providerOptions.find(
                                                (option) => option.configName === provider
                                            )?.displayName
                                        }
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {providerOptions.map((option) => (
                                        <SelectItem
                                            key={option.configName}
                                            value={option.configName}
                                        >
                                            {option.displayName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>

                        <Field>
                            <FieldLabel htmlFor="catalog-model-id">Model ID</FieldLabel>
                            <Input
                                autoComplete="off"
                                autoFocus
                                id="catalog-model-id"
                                onChange={(event) => setModelId(event.target.value)}
                                placeholder="moonshotai/kimi-k2.5"
                                value={modelId}
                            />
                        </Field>

                        {addMutation.error?.message ? (
                            <Alert variant="error">
                                <Icon icon={AlertCircleIcon} />
                                <AlertDescription>{addMutation.error.message}</AlertDescription>
                            </Alert>
                        ) : null}
                    </DialogPanel>
                    <DialogFooter>
                        <DialogClose render={<Button type="button" variant="ghost" />}>
                            Cancel
                        </DialogClose>
                        <Button disabled={!canAdd} loading={addMutation.isPending} type="submit">
                            Add model
                        </Button>
                    </DialogFooter>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function matchesSearch(
    model: ModelInventoryOutput['providers'][number]['models'][number],
    search: string
) {
    const normalizedSearch = search.trim().toLowerCase();

    if (normalizedSearch.length === 0) {
        return true;
    }

    return [model.displayName, model.ref, model.description ?? ''].some((value) =>
        value.toLowerCase().includes(normalizedSearch)
    );
}

function ModelInventoryLoadingState() {
    return (
        <div className="flex flex-col gap-4 pb-4">
            <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-10 w-72 rounded-xl" />
                <Skeleton className="h-9 w-28 rounded-md" />
            </div>
            <Skeleton className="h-36 rounded-xl" />
            <Skeleton className="h-36 rounded-xl" />
        </div>
    );
}
