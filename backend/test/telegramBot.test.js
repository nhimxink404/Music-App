import assert from 'node:assert/strict';
import test from 'node:test';
import { telegramUploadErrorMessage } from '../src/services/telegramBot.js';

const audio = { fileName: 'Bài hát dài.mp3', fileSize: 45 * 1024 * 1024 };

test('telegramUploadErrorMessage explains Telegram file size errors', () => {
  const message = telegramUploadErrorMessage({ description: 'Bad Request: file is too big' }, audio);
  assert.match(message, /file quá lớn/);
  assert.match(message, /20 MB/);
  assert.match(message, /collabos\.xyz/);
});

test('telegramUploadErrorMessage explains storage errors', () => {
  assert.match(telegramUploadErrorMessage({ code: 'ENOSPC' }, audio), /hết dung lượng/);
  assert.match(telegramUploadErrorMessage({ code: 'EACCES' }, audio), /không có quyền ghi/);
});
