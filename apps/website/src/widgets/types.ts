export interface TavernWidget {
    component: string | null;
    fallbackText: string;
    id: string;
    props?: unknown;
    target: string | null;
    validationError: string | null;
}
