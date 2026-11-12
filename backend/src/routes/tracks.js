import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { config } from '../config.js';
import { Favorite } from '../models/Favorite.js';
import { Playlist } from '../models/Playlist.js';
import { Track } from '../models/Track.js';
import {
  cancelUploadSession,
  completeUploadSession,
  createUploadSession,
  storeUploadChunk,
} from '../services/chunkedUploads.js';
import {
  assertMp3File,
  normalizeFilenameEncoding,
  registerTrack,
  reserveUniqueStorageTarget,
  resolveStoragePath,
  safeMp3Filename,
  synchronizeMusicLibrary,
  temporaryUploadName,
} from '../services/musicLibrary.js';

export const tracksRouter = express.Router();
const chunkBody = express.raw({ type: 'application/octet-stream', limit: '9mb' });

const upload = multer({
  limits: { fileSize: config.maxUploadBytes, files: 1 },
  fileFilter: (_request, file, callback) => {
    file.originalname = normalizeFilenameEncoding(file.originalname);
    const valid = /\.mp3$/i.test(file.originalname) && ['audio/mpeg', 'audio/mp3', 'application/octet-stream'].includes(file.mimetype);
    callback(valid ? null : Object.assign(new Error('Chi chap nhan file MP3.'), { status: 400 }), valid);
  },
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => callback(null, config.musicDirectory),
    filename: (_request, _file, callback) => callback(null, temporaryUploadName()),
  }),
});

function validId(id) {
  return mongoose.isObjectIdOrHexString(id);
}

tracksRouter.get('/', async (request, response, next) => {
  try {
    if (request.query.sync === 'true') await synchronizeMusicLibrary();
    const query = request.query.search
      ? { title: { $regex: String(request.query.search).slice(0, 100), $options: 'i' } }
      : {};
    const tracks = await Track.find(query).sort({ createdAt: -1 });
    response.json({ tracks });
  } catch (error) {
    next(error);
  }
});

tracksRouter.post('/upload', upload.single('file'), async (request, response, next) => {
  if (!request.file) return next(Object.assign(new Error('Vui long chon file MP3.'), { status: 400 }));

  let target;
  try {
    target = await reserveUniqueStorageTarget(safeMp3Filename(request.file.originalname));
    await pipeline(fs.createReadStream(request.file.path), target.fileHandle.createWriteStream());
    await fs.promises.rm(request.file.path, { force: true });
    await assertMp3File(target.absolutePath);
    const track = await registerTrack({
      storageKey: target.storageKey,
      filename: request.file.originalname,
      preferredTitle: request.file.originalname,
      source: 'upload',
    });
    response.status(201).json({ track });
  } catch (error) {
    await target?.fileHandle?.close().catch(() => {});
    await fs.promises.rm(request.file.path, { force: true }).catch(() => {});
    if (target?.absolutePath) await fs.promises.rm(target.absolutePath, { force: true }).catch(() => {});
    next(error);
  }
});

tracksRouter.post('/uploads', async (request, response, next) => {
  try {
    const uploadSession = await createUploadSession(request.body);
    response.status(201).json({ upload: uploadSession });
  } catch (error) {
    next(error);
  }
});

tracksRouter.put('/uploads/:uploadId/chunks/:chunkIndex', chunkBody, async (request, response, next) => {
  try {
    const chunk = await storeUploadChunk(request.params.uploadId, request.params.chunkIndex, request.body);
    response.json({ chunk });
  } catch (error) {
    next(error);
  }
});

tracksRouter.post('/uploads/:uploadId/complete', async (request, response, next) => {
  try {
    const track = await completeUploadSession(request.params.uploadId);
    response.status(201).json({ track });
  } catch (error) {
    next(error);
  }
});

tracksRouter.delete('/uploads/:uploadId', async (request, response, next) => {
  try {
    await cancelUploadSession(request.params.uploadId);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

tracksRouter.get('/:id/stream', async (request, response, next) => {
  try {
    if (!validId(request.params.id)) throw Object.assign(new Error('ID bai hat khong hop le.'), { status: 400 });
    const track = await Track.findById(request.params.id);
    if (!track) throw Object.assign(new Error('Khong tim thay bai hat.'), { status: 404 });

    const filePath = resolveStoragePath(track.storageKey);
    const stats = await fs.promises.stat(filePath).catch(() => null);
    if (!stats) throw Object.assign(new Error('File nhac khong con tren may chu.'), { status: 404 });

    const range = request.headers.range;
    response.set({
      'Accept-Ranges': 'bytes',
      'Content-Type': track.mimeType || 'audio/mpeg',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(path.basename(track.filename))}`,
      'Cache-Control': 'private, max-age=3600',
    });

    if (!range) {
      response.set('Content-Length', stats.size);
      fs.createReadStream(filePath).pipe(response);
      return;
    }

    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) {
      response.status(416).set('Content-Range', `bytes */${stats.size}`).end();
      return;
    }

    const suffixLength = !match[1] && match[2] ? Number(match[2]) : null;
    const start = suffixLength === null ? Number(match[1]) : Math.max(0, stats.size - suffixLength);
    const end = suffixLength === null && match[2] ? Number(match[2]) : stats.size - 1;
    if (suffixLength === 0 || start > end || end >= stats.size) {
      response.status(416).set('Content-Range', `bytes */${stats.size}`).end();
      return;
    }

    response.status(206).set({
      'Content-Range': `bytes ${start}-${end}/${stats.size}`,
      'Content-Length': end - start + 1,
    });
    fs.createReadStream(filePath, { start, end }).pipe(response);
  } catch (error) {
    next(error);
  }
});

tracksRouter.delete('/:id', async (request, response, next) => {
  try {
    if (!validId(request.params.id)) throw Object.assign(new Error('ID bai hat khong hop le.'), { status: 400 });
    const track = await Track.findById(request.params.id);
    if (!track) throw Object.assign(new Error('Khong tim thay bai hat.'), { status: 404 });
    await fs.promises.rm(resolveStoragePath(track.storageKey), { force: true });
    await Promise.all([
      Track.deleteOne({ _id: track._id }),
      Favorite.deleteMany({ track: track._id }),
      Playlist.updateMany({}, { $pull: { tracks: track._id } }),
    ]);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});
