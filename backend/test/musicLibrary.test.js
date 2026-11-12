import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { config } from '../src/config.js';
import {
  assertMp3File,
  normalizeFilenameEncoding,
  reserveUniqueStorageTarget,
  resolveStoragePath,
  safeMp3Filename,
} from '../src/services/musicLibrary.js';

test('safeMp3Filename preserves a valid Vietnamese MP3 name', () => {
  assert.equal(safeMp3Filename('Bài hát mới.mp3'), 'Bài hát mới.mp3');
});

test('normalizeFilenameEncoding repairs UTF-8 decoded as Latin-1', () => {
  const expected = 'Linh Cảm Tim Em - Tino Remix.mp3';
  const mojibake = Buffer.from(expected, 'utf8').toString('latin1');
  assert.equal(normalizeFilenameEncoding(mojibake), expected);
  assert.equal(normalizeFilenameEncoding(expected), expected);
});

test('safeMp3Filename removes path and invalid filename characters', () => {
  assert.equal(safeMp3Filename('../bad:name?.mp3'), 'bad_name_.mp3');
});

test('resolveStoragePath rejects path traversal', () => {
  assert.throws(() => resolveStoragePath('../outside.mp3'), /Invalid storage key/);
  assert.equal(resolveStoragePath('track.mp3'), path.join(config.musicDirectory, 'track.mp3'));
});

test('reserveUniqueStorageTarget atomically separates duplicate names', async () => {
  const originalDirectory = config.musicDirectory;
  const temporaryDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'sonora-test-'));
  config.musicDirectory = temporaryDirectory;

  try {
    const first = await reserveUniqueStorageTarget('same.mp3');
    const second = await reserveUniqueStorageTarget('same.mp3');
    await Promise.all([first.fileHandle.close(), second.fileHandle.close()]);
    await assert.rejects(() => assertMp3File(first.absolutePath), /không phải MP3/);
    assert.equal(first.storageKey, 'same.mp3');
    assert.equal(second.storageKey, 'same (2).mp3');
  } finally {
    config.musicDirectory = originalDirectory;
    await fs.promises.rm(temporaryDirectory, { recursive: true, force: true });
  }
});
