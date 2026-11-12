import { config } from '../config.js';

export function notFound(_request, response) {
  response.status(404).json({ message: 'Khong tim thay tai nguyen.' });
}

export function errorHandler(error, _request, response, _next) {
  console.error(error);
  const uploadTooLarge = error.code === 'LIMIT_FILE_SIZE';
  const status = uploadTooLarge ? 413 : error.status || (error.name === 'ValidationError' ? 400 : 500);
  const message = uploadTooLarge
    ? `File vượt giới hạn ${Math.round(config.maxUploadBytes / 1024 / 1024)} MB.`
    : status >= 500 ? 'Máy chủ đang gặp sự cố. Vui lòng thử lại.' : error.message;
  response.status(status).json({ message });
}
