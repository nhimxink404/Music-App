import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import {
  assertMp3File,
  ensureMusicDirectory,
  normalizeFilenameEncoding,
  registerTrack,
  reserveUniqueStorageTarget,
  safeMp3Filename,
} from './musicLibrary.js';

export const CHUNK_SIZE = 8 * 1024 * 1024;
const UPLOAD_ID_PATTERN = /^[0-9a-f-]{36}$/i;

function uploadRoot() {
  return path.join(config.musicDirectory, '.uploads');
}

function sessionDirectory(uploadId) {
  if (!UPLOAD_ID_PATTERN.test(uploadId)) {
    throw Object.assign(new Error('ID phiên upload không hợp lệ.'), { status: 400 });
  }
  return path.join(uploadRoot(), uploadId);
}

async function readManifest(uploadId) {
  const directory = sessionDirectory(uploadId);
  try {
    const manifest = JSON.parse(await fs.promises.readFile(path.join(directory, 'manifest.json'), 'utf8'));
    return { directory, manifest };
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw Object.assign(new Error('Phiên upload không tồn tại hoặc đã hết hạn.'), { status: 404 });
    }
    throw error;
  }
}

export async function createUploadSession({ filename, size }) {
  const normalizedFilename = normalizeFilenameEncoding(filename);
  const numericSize = Number(size);
  if (!/\.mp3$/i.test(normalizedFilename)) {
    throw Object.assign(new Error('Chỉ chấp nhận file MP3.'), { status: 400 });
  }
  if (!Number.isSafeInteger(numericSize) || numericSize < 1) {
    throw Object.assign(new Error('Kích thước file không hợp lệ.'), { status: 400 });
  }
  if (numericSize > config.maxUploadBytes) {
    throw Object.assign(new Error(`File vượt giới hạn ${Math.round(config.maxUploadBytes / 1024 / 1024)} MB.`), { status: 413 });
  }

  await ensureMusicDirectory();
  await fs.promises.mkdir(uploadRoot(), { recursive: true });
  const uploadId = crypto.randomUUID();
  const directory = sessionDirectory(uploadId);
  const manifest = {
    uploadId,
    filename: safeMp3Filename(normalizedFilename),
    size: numericSize,
    chunkSize: CHUNK_SIZE,
    totalChunks: Math.ceil(numericSize / CHUNK_SIZE),
    createdAt: new Date().toISOString(),
  };
  await fs.promises.mkdir(directory, { recursive: false });
  await fs.promises.writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest), { flag: 'wx' });
  return manifest;
}

export async function cleanupStaleUploadSessions(maxAgeMs = 24 * 60 * 60 * 1000) {
  await ensureMusicDirectory();
  await fs.promises.mkdir(uploadRoot(), { recursive: true });
  const entries = await fs.promises.readdir(uploadRoot(), { withFileTypes: true });
  const cutoff = Date.now() - maxAgeMs;

  for (const entry of entries) {
    if (!entry.isDirectory() || !UPLOAD_ID_PATTERN.test(entry.name)) continue;
    const directory = sessionDirectory(entry.name);
    const stats = await fs.promises.stat(directory);
    if (stats.mtimeMs < cutoff) await fs.promises.rm(directory, { recursive: true, force: true });
  }
}

export async function storeUploadChunk(uploadId, chunkIndex, buffer) {
  const { directory, manifest } = await readManifest(uploadId);
  const index = Number(chunkIndex);
  if (!Number.isSafeInteger(index) || index < 0 || index >= manifest.totalChunks) {
    throw Object.assign(new Error('Thứ tự phần upload không hợp lệ.'), { status: 400 });
  }
  if (!Buffer.isBuffer(buffer)) {
    throw Object.assign(new Error('Dữ liệu phần upload không hợp lệ.'), { status: 400 });
  }

  const expectedSize = index === manifest.totalChunks - 1
    ? manifest.size - index * manifest.chunkSize
    : manifest.chunkSize;
  if (buffer.length !== expectedSize) {
    throw Object.assign(new Error(`Phần ${index + 1} có kích thước không đúng.`), { status: 400 });
  }

  await fs.promises.writeFile(path.join(directory, `${index}.part`), buffer);
  return { index, receivedBytes: buffer.length };
}

export async function completeUploadSession(uploadId) {
  const { directory, manifest } = await readManifest(uploadId);
  let lockHandle;
  let target;

  try {
    lockHandle = await fs.promises.open(path.join(directory, '.complete-lock'), 'wx');
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw Object.assign(new Error('Phiên upload đang được hoàn tất.'), { status: 409 });
    }
    throw error;
  }

  try {
    const partPaths = [];
    let totalBytes = 0;
    for (let index = 0; index < manifest.totalChunks; index += 1) {
      const partPath = path.join(directory, `${index}.part`);
      const stats = await fs.promises.stat(partPath).catch(() => null);
      if (!stats) throw Object.assign(new Error(`Thiếu phần upload ${index + 1}/${manifest.totalChunks}.`), { status: 409 });
      partPaths.push(partPath);
      totalBytes += stats.size;
    }
    if (totalBytes !== manifest.size) {
      throw Object.assign(new Error('Tổng dung lượng các phần upload không khớp file gốc.'), { status: 409 });
    }

    target = await reserveUniqueStorageTarget(manifest.filename);
    let offset = 0;
    for (const partPath of partPaths) {
      const part = await fs.promises.readFile(partPath);
      let partOffset = 0;
      while (partOffset < part.length) {
        const { bytesWritten } = await target.fileHandle.write(
          part,
          partOffset,
          part.length - partOffset,
          offset + partOffset,
        );
        if (!bytesWritten) throw new Error('Không thể ghi dữ liệu upload vào file đích.');
        partOffset += bytesWritten;
      }
      offset += part.length;
    }
    await target.fileHandle.close();
    target.fileHandle = null;
    await assertMp3File(target.absolutePath);

    const track = await registerTrack({
      storageKey: target.storageKey,
      filename: manifest.filename,
      preferredTitle: manifest.filename,
      source: 'upload',
    });
    await lockHandle.close();
    lockHandle = null;
    await fs.promises.rm(directory, { recursive: true, force: true });
    return track;
  } catch (error) {
    await target?.fileHandle?.close().catch(() => {});
    await lockHandle?.close().catch(() => {});
    if (target?.absolutePath) await fs.promises.rm(target.absolutePath, { force: true }).catch(() => {});
    await fs.promises.rm(path.join(directory, '.complete-lock'), { force: true }).catch(() => {});
    throw error;
  }
}

export async function cancelUploadSession(uploadId) {
  const directory = sessionDirectory(uploadId);
  await fs.promises.rm(directory, { recursive: true, force: true });
}
