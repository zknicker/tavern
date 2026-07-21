const pathWriteLocks = new Map<string, Promise<void>>();

export async function withWikiPathWriteLock<Result>(
    key: string,
    write: () => Promise<Result>
): Promise<Result> {
    const previous = pathWriteLocks.get(key) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const current = new Promise<void>((resolve) => {
        release = resolve;
    });
    const tail = previous.then(() => current);
    pathWriteLocks.set(key, tail);

    await previous;
    try {
        return await write();
    } finally {
        release();
        if (pathWriteLocks.get(key) === tail) {
            pathWriteLocks.delete(key);
        }
    }
}
