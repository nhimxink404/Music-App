import http from 'node:http';
import mongoose from 'mongoose';
import { app } from './app.js';
import { config } from './config.js';
import { cleanupStaleUploadSessions } from './services/chunkedUploads.js';
import { synchronizeMusicLibrary } from './services/musicLibrary.js';
import { startTelegramBot, stopTelegramBot } from './services/telegramBot.js';

let server;

async function start() {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
  console.log('[database] MongoDB connected');
  await synchronizeMusicLibrary();
  await cleanupStaleUploadSessions();
  startTelegramBot();

  server = http.createServer(app);
  server.listen(config.port, '0.0.0.0', () => {
    console.log(`[server] Listening on port ${config.port}`);
  });
}

async function shutdown(signal) {
  console.log(`[server] ${signal} received, shutting down`);
  await stopTelegramBot().catch(() => {});
  await new Promise((resolve) => server?.close(resolve));
  await mongoose.disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (error) => console.error('[server] Unhandled rejection:', error));

start().catch((error) => {
  console.error('[server] Startup failed:', error);
  process.exit(1);
});
