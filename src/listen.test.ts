import net from 'node:net';
import { afterAll, describe, expect, test } from 'vitest';
import { Hono } from 'hono';
import { listenWithRetry } from './listen.js';

const closers: (() => void)[] = [];
afterAll(() => closers.forEach((c) => c()));

describe('listenWithRetry', () => {
  test('binds the base port when free', async () => {
    const app = new Hono().get('/', (c) => c.text('ok'));
    const { port, server } = await listenWithRetry(app.fetch, '127.0.0.1', 0, 1);
    closers.push(() => server.close());
    expect(port).toBeGreaterThan(0);
    const res = await fetch(`http://127.0.0.1:${port}/`);
    expect(await res.text()).toBe('ok');
  });

  test('falls through to the next port when taken', async () => {
    const blocker = net.createServer().listen(0, '127.0.0.1');
    await new Promise((r) => blocker.once('listening', r));
    const taken = (blocker.address() as net.AddressInfo).port;
    closers.push(() => blocker.close());

    const app = new Hono().get('/', (c) => c.text('ok'));
    const { port, server } = await listenWithRetry(app.fetch, '127.0.0.1', taken, 5);
    closers.push(() => server.close());
    expect(port).toBe(taken + 1);
  });

  test('rejects when every attempt is taken', async () => {
    const blocker = net.createServer().listen(0, '127.0.0.1');
    await new Promise((r) => blocker.once('listening', r));
    const taken = (blocker.address() as net.AddressInfo).port;
    closers.push(() => blocker.close());

    const app = new Hono();
    await expect(listenWithRetry(app.fetch, '127.0.0.1', taken, 1)).rejects.toThrow();
  });
});
