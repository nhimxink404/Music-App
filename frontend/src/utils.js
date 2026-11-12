export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

export function formatFileSize(bytes) {
  if (!bytes) return '';
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
