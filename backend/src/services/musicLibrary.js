import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileTypeFromFile } from 'file-type';
import { parseFile } from 'music-metadata';
import { config } from '../config.js';
import { Favorite } from '../models/Favorite.js';
import { Playlist } from '../models/Playlist.js';
import { Track } from '../models/Track.js';

const MP3_EXTENSION = /\.mp3$/i;

export function normalizeFilenameEncoding(filename) {
  const original = String(filename || '');
  const decoded = Buffer.from(original, 'latin1').toString('utf8');
  return (decoded.includes('\uFFFD') ? original : decoded).normalize('NFC');
}

export async function ensureMusicDirectory() {
  await fs.promises.mkdir(config.musicDirectory, { recursive: true });
}

export function safeMp3Filename(filename) {
  const original = path.basename(normalizeFilenameEncoding(filename) || 'track.mp3');
  const withoutInvalidCharacters = original.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim();
  const withExtension = MP3_EXTENSION.test(withoutInvalidCharacters)
    ? withoutInvalidCharacters
    : `${withoutInvalidCharacters || 'track'}.mp3`;
  return withExtension.slice(0, 220);
}

export async function uniqueStorageTarget(filename) {
  await ensureMusicDirectory();
  const safeName = safeMp3Filename(filename);
  let storageKey = safeName;
  let index = 2;

  while (fs.existsSync(path.join(config.musicDirectory, storageKey))) {
    const extension = path.extname(safeName);
    const base = path.basename(safeName, extension);
    storageKey = `${base} (${index})${extension}`;
    index += 1;
  }

  return { storageKey, absolutePath: path.join(config.musicDirectory, storageKey) };
}

export async function reserveUniqueStorageTarget(filename) {
  while (true) {
    const target = await uniqueStorageTarget(filename);
    try {
      const fileHandle = await fs.promises.open(target.absolutePath, 'wx');
      return { ...target, fileHandle };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
}

export function resolveStoragePath(storageKey) {
  const candidate = path.resolve(config.musicDirectory, storageKey);
  const root = `${path.resolve(config.musicDirectory)}${path.sep}`;
  if (!candidate.startsWith(root)) {
    throw Object.assign(new Error('Invalid storage key'), { status: 400 });
  }
  return candidate;
}

export async function assertMp3File(absolutePath) {
  const detected = await fileTypeFromFile(absolutePath);
  if (detected?.mime !== 'audio/mpeg') {
    throw Object.assign(new Error('Nội dung file không phải MP3 hợp lệ.'), { status: 400 });
  }
}

export async function registerTrack({
  storageKey,
  filename = storageKey,
  source = 'filesystem',
  telegramFileId = '',
  preferredTitle = '',
}) {
  const absolutePath = resolveStoragePath(storageKey);
  const stats = await fs.promises.stat(absolutePath);
  let metadata = {};

  try {
    metadata = await parseFile(absolutePath, { duration: true });
  } catch (error) {
    console.warn(`[library] Metadata unavailable for ${storageKey}: ${error.message}`);
  }

  const titleFromFilename = path.basename(preferredTitle || filename, path.extname(preferredTitle || filename));
  return Track.findOneAndUpdate(
    { storageKey },
    {
      title: titleFromFilename || 'Untitled track',
      filename,
      storageKey,
      mimeType: 'audio/mpeg',
      size: stats.size,
      duration: Number(metadata.format?.duration || 0),
      artist: metadata.common?.artist || '',
      album: metadata.common?.album || '',
      source,
      telegramFileId,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

export async function synchronizeMusicLibrary() {
  await ensureMusicDirectory();
  await repairFilenameEncodings();
  const entries = await fs.promises.readdir(config.musicDirectory, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile() && MP3_EXTENSION.test(entry.name));
  const existingTracks = await Track.find({}, { storageKey: 1 });
  const presentKeys = new Set(files.map((entry) => entry.name));

  for (const file of files) {
    const existing = existingTracks.some((track) => track.storageKey === file.name);
    if (!existing) {
      await registerTrack({ storageKey: file.name, filename: file.name });
    }
  }

  const missingIds = existingTracks
    .filter((track) => !presentKeys.has(track.storageKey))
    .map((track) => track._id);

  if (missingIds.length) {
    await Promise.all([
      Track.deleteMany({ _id: { $in: missingIds } }),
      Favorite.deleteMany({ track: { $in: missingIds } }),
      Playlist.updateMany({}, { $pull: { tracks: { $in: missingIds } } }),
    ]);
  }

  console.log(`[library] Synchronized ${files.length} MP3 file(s)`);
}

async function repairFilenameEncodings() {
  const entries = await fs.promises.readdir(config.musicDirectory, { withFileTypes: true });
  const repairs = entries
    .filter((entry) => entry.isFile() && MP3_EXTENSION.test(entry.name))
    .map((entry) => ({ original: entry.name, normalized: normalizeFilenameEncoding(entry.name) }))
    .filter(({ original, normalized }) => original !== normalized);

  for (const repair of repairs) {
    const originalPath = path.join(config.musicDirectory, repair.original);
    const target = await uniqueStorageTarget(repair.normalized);
    await fs.promises.rename(originalPath, target.absolutePath);

    try {
      await Track.updateMany(
        { storageKey: repair.original },
        {
          $set: {
            storageKey: target.storageKey,
            filename: repair.normalized,
            title: path.basename(repair.normalized, path.extname(repair.normalized)),
          },
        },
      );
      console.log(`[library] Repaired filename encoding: ${repair.original} -> ${target.storageKey}`);
    } catch (error) {
      await fs.promises.rename(target.absolutePath, originalPath).catch(() => {});
      throw error;
    }
  }
}

export function temporaryUploadName() {
  return `.upload-${crypto.randomUUID()}.part`;
}
