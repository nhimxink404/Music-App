import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: numberFromEnv('PORT', 5000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/sonora',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  musicDirectory: path.resolve(process.env.MUSIC_DIR || path.join(rootDirectory, 'storage', 'music')),
  telegramToken: process.env.TELEGRAM_BOT_TOKEN?.trim() || '',
  telegramAllowedUserIds: new Set(
    (process.env.TELEGRAM_ALLOWED_USER_IDS || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  ),
  maxUploadBytes: numberFromEnv('MAX_UPLOAD_MB', 300) * 1024 * 1024,
  telegramDownloadLimitBytes: numberFromEnv('TELEGRAM_DOWNLOAD_LIMIT_MB', 20) * 1024 * 1024,
};
