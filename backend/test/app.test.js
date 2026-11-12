import assert from 'node:assert/strict';
import test from 'node:test';
import { app } from '../src/app.js';

test('GET /api/health reports a healthy server', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
