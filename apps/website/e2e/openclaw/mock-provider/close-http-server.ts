import type { Server } from 'node:http';

export function closeQaHttpServer(server: Server) {
    return new Promise<void>((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}
