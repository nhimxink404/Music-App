import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { config } from '../src/config.js';
import {
  cancelUploadSession,
  completeUploadSession,
  createUploadSession,
  storeUploadChunk,
} from '../src/services/chunkedUploads.js';

test('chunked upload creates, validates, and cancels a filesystem session', async () => {
  const originalDirectory = config.musicDirectory;
  const temporaryDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'sonora-chunks-'));
  config.musicDirectory = temporaryDirectory;

  try {
    const session = await createUploadSession({ filename: 'Bài hát dài.mp3', size: 12 });
    assert.equal(session.totalChunks, 1);
    await assert.rejects(
      () => storeUploadChunk(session.uploadId, 0, Buffer.alloc(11)),
      /kích thước không đúng/,
    );
    const stored = await storeUploadChunk(session.uploadId, 0, Buffer.alloc(12));
    assert.deepEqual(stored, { index: 0, receivedBytes: 12 });
    await assert.rejects(() => completeUploadSession(session.uploadId), /không phải MP3/);
    await cancelUploadSession(session.uploadId);
    assert.equal(fs.existsSync(path.join(temporaryDirectory, '.uploads', session.uploadId)), false);
  } finally {
    config.musicDirectory = originalDirectory;
    await fs.promises.rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test('chunked upload rejects files over the configured limit', async () => {
  await assert.rejects(
    () => createUploadSession({ filename: 'too-large.mp3', size: config.maxUploadBytes + 1 }),
    /vượt giới hạn/,
  );
});
