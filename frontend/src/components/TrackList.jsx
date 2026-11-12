import { Heart, ListMinus, ListPlus, Play, Trash2 } from 'lucide-react';
import { usePlayer } from '../playerContext';
import { formatFileSize, formatTime } from '../utils';

export function TrackList({ tracks, favoriteIds, onToggleFavorite, onAddToPlaylist, onRemoveFromPlaylist, onDeleteTrack }) {
  const player = usePlayer();

  if (!tracks.length) {
    return (
      <div className="empty-state">
        <span className="empty-disc"><Play size={24} fill="currentColor" /></span>
        <h2>Chưa có bài hát</h2>
        <p>Gửi file MP3 cho Telegram bot hoặc tải lên từ nút phía trên.</p>
      </div>
    );
  }

  return (
    <div className="track-table">
      <div className="track-table-head">
        <span>#</span><span>TÊN BÀI HÁT</span><span>NGUỒN</span><span>THỜI LƯỢNG</span><span />
      </div>
      {tracks.map((track, index) => {
        const active = player.currentTrack?.id === track.id;
        const playing = active && player.isPlaying;
        return (
          <div className={`track-row ${active ? 'current' : ''}`} key={track.id}>
            <button
              className="row-play"
              onClick={() => (active ? player.togglePlay() : player.playTrack(track, tracks))}
              aria-label={playing ? `Tạm dừng ${track.title}` : `Phát ${track.title}`}
            >
              <span className="track-number">{index + 1}</span>
              {playing ? (
                <span className="playing-bars" aria-hidden="true"><i /><i /><i /></span>
              ) : <Play size={17} fill="currentColor" />}
            </button>
            <button className="track-name" onDoubleClick={() => player.playTrack(track, tracks)} onClick={() => player.playTrack(track, tracks)}>
              <strong>{track.title}</strong>
              <span>{track.artist || track.filename}</span>
            </button>
            <span className="source-badge">{track.source === 'telegram' ? 'Telegram' : track.source === 'upload' ? 'Web' : 'Folder'}</span>
            <span className="track-meta">{track.duration ? formatTime(track.duration) : formatFileSize(track.size)}</span>
            <div className="track-actions">
              <button
                className={`icon-button ${favoriteIds.has(track.id) ? 'liked' : ''}`}
                onClick={() => onToggleFavorite(track)}
                title={favoriteIds.has(track.id) ? 'Bỏ yêu thích' : 'Yêu thích'}
                aria-label={favoriteIds.has(track.id) ? 'Bỏ yêu thích' : 'Yêu thích'}
              >
                <Heart size={17} fill={favoriteIds.has(track.id) ? 'currentColor' : 'none'} />
              </button>
              {onRemoveFromPlaylist ? (
                <button className="icon-button" onClick={() => onRemoveFromPlaylist(track)} title="Xóa khỏi playlist" aria-label="Xóa khỏi playlist">
                  <ListMinus size={18} />
                </button>
              ) : (
                <button className="icon-button" onClick={() => onAddToPlaylist(track)} title="Thêm vào playlist" aria-label="Thêm vào playlist">
                  <ListPlus size={18} />
                </button>
              )}
              <button className="icon-button delete-track-button" onClick={() => onDeleteTrack(track)} title="Xóa bài hát" aria-label={`Xóa ${track.title}`}>
                <Trash2 size={17} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
