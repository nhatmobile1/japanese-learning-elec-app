import type { AddressInfo } from 'node:net';
import { serve, type ServerType } from '@hono/node-server';

/** Try basePort, basePort+1, … on EADDRINUSE. Resolves with the actual bound port. */
export function listenWithRetry(
  fetch: (req: Request) => Response | Promise<Response>,
  host: string,
  basePort: number,
  attempts = 5,
): Promise<{ port: number; server: ServerType }> {
  return new Promise((resolve, reject) => {
    const tryPort = (i: number) => {
      const server = serve({ fetch, port: basePort + i, hostname: host });
      server.once('error', (err: NodeJS.ErrnoException) => {
        server.close();
        if (err.code === 'EADDRINUSE' && i + 1 < attempts) tryPort(i + 1);
        else reject(err);
      });
      server.once('listening', () => {
        resolve({ port: (server.address() as AddressInfo).port, server });
      });
    };
    tryPort(0);
  });
}
