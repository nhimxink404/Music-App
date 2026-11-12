const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const CHUNKED_UPLOAD_THRESHOLD = 80 * 1024 * 1024;

async function request(path, options = {}) {
  const headers = { ...options.headers };
  if (typeof options.body === 'string' && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!response.ok) {
    if (response.status === 413) throw new Error('Dữ liệu upload quá lớn. Website hỗ trợ file MP3 tối đa 300 MB bằng chế độ chia nhỏ.');
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || 'Không thể kết nối máy chủ.');
  }
  if (response.status === 204) return null;
  return response.json();
}

async function uploadInChunks(file, onProgress) {
  let uploadId;
  try {
    const sessionData = await request('/tracks/uploads', {
      method: 'POST',
      body: JSON.stringify({ filename: file.name, size: file.size }),
    });
    const session = sessionData.upload;
    uploadId = session.uploadId;

    for (let index = 0; index < session.totalChunks; index += 1) {
      const start = index * session.chunkSize;
      const chunk = file.slice(start, Math.min(file.size, start + session.chunkSize));
      await request(`/tracks/uploads/${uploadId}/chunks/${index}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: chunk,
      });
      onProgress?.(Math.round(((index + 1) / session.totalChunks) * 95));
    }

    const result = await request(`/tracks/uploads/${uploadId}/complete`, { method: 'POST' });
    onProgress?.(100);
    return result;
  } catch (error) {
    if (uploadId) await request(`/tracks/uploads/${uploadId}`, { method: 'DELETE' }).catch(() => {});
    throw error;
  }
}

export const api = {
  getTracks: () => request('/tracks'),
  uploadTrack: (file, onProgress) => {
    if (file.size > CHUNKED_UPLOAD_THRESHOLD) return uploadInChunks(file, onProgress);
    const body = new FormData();
    body.append('file', file);
    return request('/tracks/upload', { method: 'POST', body });
  },
  deleteTrack: (trackId) => request(`/tracks/${trackId}`, { method: 'DELETE' }),
  streamUrl: (trackId) => `${API_BASE}/tracks/${trackId}/stream`,
  getFavorites: () => request('/favorites'),
  addFavorite: (trackId) => request(`/favorites/${trackId}`, { method: 'POST' }),
  removeFavorite: (trackId) => request(`/favorites/${trackId}`, { method: 'DELETE' }),
  getPlaylists: () => request('/playlists'),
  createPlaylist: (name) => request('/playlists', { method: 'POST', body: JSON.stringify({ name }) }),
  deletePlaylist: (playlistId) => request(`/playlists/${playlistId}`, { method: 'DELETE' }),
  addToPlaylist: (playlistId, trackId) => request(`/playlists/${playlistId}/tracks`, {
    method: 'POST',
    body: JSON.stringify({ trackId }),
  }),
  removeFromPlaylist: (playlistId, trackId) => request(`/playlists/${playlistId}/tracks/${trackId}`, { method: 'DELETE' }),
};
