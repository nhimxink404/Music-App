import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { app } from '../src/app.js';
import { config } from '../src/config.js';
import { Favorite } from '../src/models/Favorite.js';
import { Playlist } from '../src/models/Playlist.js';
import { Track } from '../src/models/Track.js';

test('track stream supports suffix byte ranges', async () => {
  const originalDirectory = config.musicDirectory;
  const originalFindById = Track.findById;
  const temporaryDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'sonora-stream-'));
  const storageKey = 'range-test.mp3';
  await fs.promises.writeFile(path.join(temporaryDirectory, storageKey), Buffer.alloc(1000, 7));
  config.musicDirectory = temporaryDirectory;
  Track.findById = async () => ({ storageKey, mimeType: 'audio/mpeg', filename: storageKey });

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/tracks/507f1f77bcf86cd799439011/stream`, {
      headers: { Range: 'bytes=-100' },
    });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('content-range'), 'bytes 900-999/1000');
    assert.equal((await response.arrayBuffer()).byteLength, 100);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    Track.findById = originalFindById;
    config.musicDirectory = originalDirectory;
    await fs.promises.rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test('DELETE /api/tracks/:id removes the file and related records', async () => {
  const originalDirectory = config.musicDirectory;
  const originalMethods = {
    findById: Track.findById,
    deleteOne: Track.deleteOne,
    deleteFavorites: Favorite.deleteMany,
    updatePlaylists: Playlist.updateMany,
  };
  const temporaryDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'sonora-delete-'));
  const storageKey = 'delete-test.mp3';
  const trackId = '507f1f77bcf86cd799439011';
  const filePath = path.join(temporaryDirectory, storageKey);
  await fs.promises.writeFile(filePath, Buffer.alloc(32, 1));
  config.musicDirectory = temporaryDirectory;

  let trackDeleted = false;
  let favoritesDeleted = false;
  let playlistsUpdated = false;
  Track.findById = async () => ({ _id: trackId, storageKey });
  Track.deleteOne = async () => { trackDeleted = true; };
  Favorite.deleteMany = async () => { favoritesDeleted = true; };
  Playlist.updateMany = async () => { playlistsUpdated = true; };

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/tracks/${trackId}`, { method: 'DELETE' });
    assert.equal(response.status, 204);
    assert.equal(fs.existsSync(filePath), false);
    assert.equal(trackDeleted, true);
    assert.equal(favoritesDeleted, true);
    assert.equal(playlistsUpdated, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    Track.findById = originalMethods.findById;
    Track.deleteOne = originalMethods.deleteOne;
    Favorite.deleteMany = originalMethods.deleteFavorites;
    Playlist.updateMany = originalMethods.updatePlaylists;
    config.musicDirectory = originalDirectory;
    await fs.promises.rm(temporaryDirectory, { recursive: true, force: true });
  }
});
