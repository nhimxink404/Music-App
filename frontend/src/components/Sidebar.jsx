import { Heart, Library, ListMusic, Plus } from 'lucide-react';

export function Sidebar({ view, setView, playlists, onCreatePlaylist }) {
  return (
    <aside className="sidebar">
      <button className="brand" onClick={() => setView({ type: 'library' })} aria-label="Mo thu vien">
        <img src="/music_logo.jpg" alt="" />
        <span>SONORA</span>
      </button>

      <nav className="primary-nav" aria-label="Thu vien">
        <button className={view.type === 'library' ? 'active' : ''} onClick={() => setView({ type: 'library' })}>
          <Library size={19} /> <span>Thư viện</span>
        </button>
        <button className={view.type === 'favorites' ? 'active' : ''} onClick={() => setView({ type: 'favorites' })}>
          <Heart size={19} /> <span>Yêu thích</span>
        </button>
        <button
          className={`mobile-playlist-tab ${['playlists', 'playlist'].includes(view.type) ? 'active' : ''}`}
          onClick={() => setView({ type: 'playlists' })}
        >
          <ListMusic size={19} /> <span>Playlist</span>
        </button>
      </nav>

      <div className="playlist-nav">
        <div className="nav-heading">
          <span>PLAYLIST</span>
          <button className="icon-button" onClick={onCreatePlaylist} title="Tạo playlist" aria-label="Tạo playlist">
            <Plus size={18} />
          </button>
        </div>
        <div className="playlist-links">
          {playlists.map((playlist) => (
            <button
              key={playlist.id}
              className={view.type === 'playlist' && view.id === playlist.id ? 'active' : ''}
              onClick={() => setView({ type: 'playlist', id: playlist.id })}
            >
              <ListMusic size={17} /> <span>{playlist.name}</span>
            </button>
          ))}
          {!playlists.length && <p>Chưa có playlist</p>}
        </div>
      </div>
    </aside>
  );
}
