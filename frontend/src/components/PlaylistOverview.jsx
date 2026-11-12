import { ChevronRight, ListMusic, Plus } from 'lucide-react';

export function PlaylistOverview({ playlists, hasPlaylists, onOpen, onCreate }) {
  if (!playlists.length) {
    return (
      <div className="empty-state playlist-empty">
        <span className="empty-disc"><ListMusic size={25} /></span>
        <h2>{hasPlaylists ? 'Không tìm thấy playlist' : 'Chưa có playlist'}</h2>
        <p>{hasPlaylists ? 'Thử tìm bằng một tên khác.' : 'Tạo playlist đầu tiên để gom những bài hát bạn muốn nghe cùng nhau.'}</p>
        <button className="primary-button" onClick={onCreate}><Plus size={18} /> Tạo playlist</button>
      </div>
    );
  }

  return (
    <div className="playlist-overview">
      {playlists.map((playlist) => (
        <button className="playlist-item" key={playlist.id} onClick={() => onOpen(playlist.id)}>
          <span className="playlist-item-art">
            <ListMusic size={24} />
            <small>{playlist.tracks.length}</small>
          </span>
          <span className="playlist-item-copy">
            <strong>{playlist.name}</strong>
            <small>{playlist.tracks.length} bài hát</small>
          </span>
          <ChevronRight size={19} />
        </button>
      ))}
    </div>
  );
}
