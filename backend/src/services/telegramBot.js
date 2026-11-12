import fs from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Bot } from 'grammy';
import { config } from '../config.js';
import { assertMp3File, registerTrack, reserveUniqueStorageTarget } from './musicLibrary.js';

let bot;

function megabytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.0', '')} MB`;
}

export function telegramUploadErrorMessage(error, audio) {
  const details = String(error?.description || error?.message || 'Lỗi không xác định');

  if (/file is too big/i.test(details)) {
    return `Telegram không cho bot tải file “${audio.fileName}” vì file quá lớn (${megabytes(audio.fileSize)}). Giới hạn hiện tại là ${megabytes(config.telegramDownloadLimitBytes)}. Hãy tải file này trực tiếp tại https://collabos.xyz.`;
  }
  if (error?.code === 'ENOSPC') return 'Máy chủ đã hết dung lượng lưu nhạc. Vui lòng giải phóng ổ đĩa rồi thử lại.';
  if (['EACCES', 'EPERM'].includes(error?.code)) return 'Backend không có quyền ghi vào thư mục nhạc. Vui lòng kiểm tra quyền của Docker volume.';
  if (error?.status && error.status < 500) return error.message;
  if (/Telegram download failed/i.test(details)) return `Telegram không trả được dữ liệu file “${audio.fileName}”. Chi tiết: ${details}`;

  return `Không thể lưu “${audio.fileName}”. Chi tiết: ${details.slice(0, 180)}`;
}

function isAllowed(message) {
  return config.telegramAllowedUserIds.has(String(message.from?.id || ''));
}

function audioDetails(message) {
  const telegramAudioIsMp3 = message.audio && (
    /\.mp3$/i.test(message.audio.file_name || '')
    || ['audio/mpeg', 'audio/mp3'].includes(message.audio.mime_type || '')
  );

  if (telegramAudioIsMp3) {
    return {
      fileId: message.audio.file_id,
      fileName: message.audio.file_name || `${message.audio.title || 'track'}.mp3`,
      fileSize: message.audio.file_size || 0,
    };
  }

  if (message.document && /\.mp3$/i.test(message.document.file_name || '')) {
    return {
      fileId: message.document.file_id,
      fileName: message.document.file_name,
      fileSize: message.document.file_size || 0,
    };
  }

  return null;
}

async function handleMessage(context) {
  const message = context.message;
  if (!isAllowed(message)) {
    await context.reply('Tài khoản này không được phép tải nhạc lên.');
    return;
  }

  const audio = audioDetails(message);
  if (!audio) {
    await context.reply('Hãy gửi một file MP3 dưới dạng Audio hoặc Document.');
    return;
  }

  if (audio.fileSize > config.maxUploadBytes) {
    await context.reply(`Không thể nhận “${audio.fileName}”: file có dung lượng ${megabytes(audio.fileSize)}, vượt giới hạn ứng dụng ${megabytes(config.maxUploadBytes)}.`);
    return;
  }

  if (audio.fileSize > config.telegramDownloadLimitBytes) {
    await context.reply(`Telegram Bot API chỉ cho bot tải file tối đa ${megabytes(config.telegramDownloadLimitBytes)}. File “${audio.fileName}” có dung lượng ${megabytes(audio.fileSize)}. Hãy tải trực tiếp tại https://collabos.xyz (tối đa ${megabytes(config.maxUploadBytes)}).`);
    return;
  }

  const status = await context.reply(`Đang nhận: ${audio.fileName}`);
  let target;

  try {
    target = await reserveUniqueStorageTarget(audio.fileName);
    const telegramFile = await context.api.getFile(audio.fileId);
    if (!telegramFile.file_path) throw new Error('Telegram did not return a file path');
    const downloadUrl = `https://api.telegram.org/file/bot${config.telegramToken}/${telegramFile.file_path}`;
    const response = await fetch(downloadUrl);
    if (!response.ok || !response.body) throw new Error(`Telegram download failed (${response.status})`);

    await pipeline(Readable.fromWeb(response.body), target.fileHandle.createWriteStream());
    await assertMp3File(target.absolutePath);
    const track = await registerTrack({
      storageKey: target.storageKey,
      filename: audio.fileName,
      preferredTitle: audio.fileName,
      source: 'telegram',
      telegramFileId: audio.fileId,
    });
    await context.api.editMessageText(message.chat.id, status.message_id, `Đã thêm bài hát: ${track.title}`);
  } catch (error) {
    await target?.fileHandle?.close().catch(() => {});
    if (target?.absolutePath) await fs.promises.rm(target.absolutePath, { force: true }).catch(() => {});
    console.error('[telegram] Upload failed:', error);
    await context.api.editMessageText(message.chat.id, status.message_id, telegramUploadErrorMessage(error, audio));
  }
}

export function startTelegramBot() {
  if (!config.telegramToken) {
    console.log('[telegram] Disabled: TELEGRAM_BOT_TOKEN is not configured');
    return null;
  }

  if (!config.telegramAllowedUserIds.size) {
    console.warn('[telegram] Disabled: TELEGRAM_ALLOWED_USER_IDS is empty');
    return null;
  }

  bot = new Bot(config.telegramToken);
  bot.on('message', (context) => handleMessage(context));
  bot.catch((error) => console.error('[telegram] Bot error:', error.error));
  void bot.start({ onStart: () => console.log('[telegram] Bot polling started') })
    .catch((error) => console.error('[telegram] Polling stopped:', error));
  return bot;
}

export async function stopTelegramBot() {
  if (bot?.isRunning()) await bot.stop();
}
