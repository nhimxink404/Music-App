import { Check, Music2, Play, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { Modal } from './components/Modal';
import { PlayerBar } from './components/PlayerBar';
import { PlaylistOverview } from './components/PlaylistOverview';
import { Sidebar } from './components/Sidebar';
import { TrackList } from './components/TrackList';
import { usePlayer } from './playerContext';

const MAX_WEB_UPLOAD_BYTES = 300 * 1024 * 1024;

export default function App() {
  const player = usePlayer();
  const fileInput = useRef(null);
  const [tracks, setTracks] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [view, setView] = useState({ type: 'library' });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deletingTrackId, setDeletingTrackId] = useState(null);
  const [modal, setModal] = useState(null);
  const [playlistName, setPlaylistName] = useState('');
  const [toast, setToast] = useState(null);

  const notify = (message, type = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  };

  async function refresh() {
    const [trackData, favoriteData, playlistData] = await Promise.all([
      api.getTracks(), api.getFavorites(), api.getPlaylists(),
    ]);
    setTracks(trackData.tracks);
    setFavorites(favoriteData.tracks);
    setPlaylists(playlistData.playlists);
  }

  useEffect(() => {
    refresh().catch((error) => notify(error.message, 'error')).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setSearch('');
  }, [view.type, view.id]);

  const selectedPlaylist = view.type === 'playlist' ? playlists.find((item) => item.id === view.id) : null;
  const favoriteIds = useMemo(() => new Set(favorites.map((track) => track.id)), [favorites]);
  const visibleTracks = useMemo(() => {
    const source = view.type === 'favorites' ? favorites : view.type === 'playlist' ? (selectedPlaylist?.tracks || []) : view.type === 'playlists' ? [] : tracks;
    const query = search.trim().toLocaleLowerCase('vi');
    if (!query) return source;
    return source.filter((track) => `${track.title} ${track.artist} ${track.filename}`.toLocaleLowerCase('vi').includes(query));
  }, [favorites, search, selectedPlaylist, tracks, view.type]);

  const visiblePlaylists = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi');
    if (!query) return playlists;
    return playlists.filter((playlist) => playlist.name.toLocaleLowerCase('vi').includes(query));
  }, [playlists, search]);

  const heading = view.type === 'favorites' ? 'Bài hát yêu thích' : view.type === 'playlist' ? (selectedPlaylist?.name || 'Playlist') : view.type === 'playlists' ? 'Playlist của bạn' : 'Thư viện nhạc';
  const eyebrow = ['playlist', 'playlists'].includes(view.type) ? 'BỘ SƯU TẬP' : view.type === 'favorites' ? 'BỘ SƯU TẬP' : 'KHÔNG GIAN CỦA BẠN';
  const headerMeta = view.type === 'playlists'
    ? `${visiblePlaylists.length} playlist · sẵn sàng để nghe`
    : `${visibleTracks.length} bài hát${selectedPlaylist?.description ? ` · ${selectedPlaylist.description}` : ' · sẵn sàng để phát'}`;

  async function toggleFavorite(track) {
    try {
      if (favoriteIds.has(track.id)) {
        await api.removeFavorite(track.id);
        setFavorites((items) => items.filter((item) => item.id !== track.id));
      } else {
        await api.addFavorite(track.id);
        setFavorites((items) => [track, ...items]);
      }
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/\.mp3$/i.test(file.name)) return notify('Chỉ chấp nhận file MP3.', 'error');
    if (file.size > MAX_WEB_UPLOAD_BYTES) return notify('File vượt giới hạn upload trên web là 300 MB.', 'error');
    setUploading(true);
    setUploadProgress(0);
    try {
      const data = await api.uploadTrack(file, setUploadProgress);
      setTracks((items) => [data.track, ...items]);
      notify(`Đã thêm “${data.track.title}”`);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  async function createPlaylist(event) {
    event.preventDefault();
    try {
      const data = await api.createPlaylist(playlistName);
      setPlaylists((items) => [data.playlist, ...items]);
      setPlaylistName('');
      setModal(null);
      setView({ type: 'playlist', id: data.playlist.id });
      notify('Đã tạo playlist.');
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  async function addToPlaylist(playlistId, track) {
    try {
      const data = await api.addToPlaylist(playlistId, track.id);
      setPlaylists((items) => items.map((item) => item.id === playlistId ? data.playlist : item));
      setModal(null);
      notify(`Đã thêm “${track.title}” vào playlist.`);
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  async function removeFromPlaylist(track) {
    try {
      const data = await api.removeFromPlaylist(selectedPlaylist.id, track.id);
      setPlaylists((items) => items.map((item) => item.id === selectedPlaylist.id ? data.playlist : item));
      notify('Đã xóa bài hát khỏi playlist.');
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  async function deletePlaylist() {
    try {
      await api.deletePlaylist(selectedPlaylist.id);
      setPlaylists((items) => items.filter((item) => item.id !== selectedPlaylist.id));
      setView({ type: 'library' });
      notify('Đã xóa playlist.');
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  async function deleteTrack(track) {
    setDeletingTrackId(track.id);
    player.removeTrack(track.id);

    try {
      await api.deleteTrack(track.id);
      setTracks((items) => items.filter((item) => item.id !== track.id));
      setFavorites((items) => items.filter((item) => item.id !== track.id));
      setPlaylists((items) => items.map((playlist) => ({
        ...playlist,
        tracks: playlist.tracks.filter((item) => item.id !== track.id),
      })));
      setModal(null);
      notify(`Đã xóa “${track.title}”.`);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setDeletingTrackId(null);
    }
  }

  return (
    <div className="app-shell">
      <Sidebar view={view} setView={setView} playlists={playlists} onCreatePlaylist={() => setModal({ type: 'create' })} />
      <main className="main-content">
        <header className="topbar">
          <label className="search-box">
            <Search size={18} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={view.type === 'playlists' ? 'Tìm playlist...' : 'Tìm bài hát...'} />
            {search && <button onClick={() => setSearch('')} aria-label="Xóa tìm kiếm"><X size={16} /></button>}
          </label>
          <input ref={fileInput} hidden type="file" accept=".mp3,audio/mpeg" onChange={handleUpload} />
          <button className="upload-button" onClick={() => fileInput.current?.click()} disabled={uploading}>
            <Upload size={18} /> <span>{uploading ? `Đang tải${uploadProgress ? ` ${uploadProgress}%` : '...'}` : 'Tải MP3 lên'}</span>
          </button>
        </header>

        <section className={`library-header ${player.isPlaying ? 'music-active' : ''}`}>
          <div className={`header-artwork ${player.isPlaying ? 'playing' : ''}`}>
            <div className="header-art vinyl-record">
              <div className="vinyl-label"><img src="/music_logo.jpg" alt="Sonora neon music" /></div>
            </div>
          </div>
          <div className="header-copy">
            <span>{eyebrow}</span>
            <h1>{heading}</h1>
            <p>{headerMeta}</p>
            <div className="header-actions">
              {view.type === 'playlists' ? (
                <button className="play-all" onClick={() => setModal({ type: 'create' })}><Plus size={19} /> Tạo playlist</button>
              ) : (
                <button className="play-all" disabled={!visibleTracks.length} onClick={() => player.playTrack(visibleTracks[0], visibleTracks)}>
                  <Play size={19} fill="currentColor" /> Phát tất cả
                </button>
              )}
              {view.type === 'playlist' && (
                <button className="icon-button delete-playlist" onClick={deletePlaylist} title="Xóa playlist" aria-label="Xóa playlist"><Trash2 size={19} /></button>
              )}
            </div>
          </div>
        </section>

        <section className="track-section">
          {loading ? (
            <div className="loading-state"><span /><p>Đang mở thư viện...</p></div>
          ) : view.type === 'playlists' ? (
            <PlaylistOverview
              playlists={visiblePlaylists}
              hasPlaylists={playlists.length > 0}
              onOpen={(id) => setView({ type: 'playlist', id })}
              onCreate={() => setModal({ type: 'create' })}
            />
          ) : (
            <TrackList
              tracks={visibleTracks}
              favoriteIds={favoriteIds}
              onToggleFavorite={toggleFavorite}
              onAddToPlaylist={(track) => setModal({ type: 'add', track })}
              onRemoveFromPlaylist={view.type === 'playlist' ? removeFromPlaylist : null}
              onDeleteTrack={(track) => setModal({ type: 'delete-track', track })}
            />
          )}
        </section>
      </main>

      <PlayerBar favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} />

      {modal?.type === 'create' && (
        <Modal title="Tạo playlist mới" onClose={() => setModal(null)}>
          <form className="modal-form" onSubmit={createPlaylist}>
            <label>Tên playlist<input autoFocus maxLength="80" value={playlistName} onChange={(event) => setPlaylistName(event.target.value)} placeholder="Ví dụ: Nhạc buổi tối" /></label>
            <button className="primary-button" disabled={!playlistName.trim()}><Plus size={18} /> Tạo playlist</button>
          </form>
        </Modal>
      )}

      {modal?.type === 'add' && (
        <Modal title="Thêm vào playlist" onClose={() => setModal(null)}>
          <div className="modal-track"><Music2 size={19} /><span><strong>{modal.track.title}</strong><small>{modal.track.artist || 'Sonora Library'}</small></span></div>
          <div className="playlist-picker">
            {playlists.map((playlist) => {
              const alreadyAdded = playlist.tracks.some((track) => track.id === modal.track.id);
              return (
                <button key={playlist.id} disabled={alreadyAdded} onClick={() => addToPlaylist(playlist.id, modal.track)}>
                  <span>{playlist.name}<small>{playlist.tracks.length} bài hát</small></span>
                  {alreadyAdded ? <Check size={18} /> : <Plus size={18} />}
                </button>
              );
            })}
            {!playlists.length && <p className="picker-empty">Bạn chưa có playlist nào.</p>}
          </div>
          <button className="secondary-button full-button" onClick={() => { setModal({ type: 'create' }); setPlaylistName(''); }}><Plus size={17} /> Tạo playlist mới</button>
        </Modal>
      )}

      {modal?.type === 'delete-track' && (
        <Modal title="Xóa bài hát?" onClose={() => !deletingTrackId && setModal(null)}>
          <div className="delete-confirmation">
            <span><Trash2 size={22} /></span>
            <div>
              <strong>{modal.track.title}</strong>
              <p>File MP3 sẽ bị xóa khỏi máy chủ, đồng thời bài hát sẽ được gỡ khỏi yêu thích và tất cả playlist.</p>
            </div>
          </div>
          <div className="delete-modal-actions">
            <button className="secondary-button" disabled={Boolean(deletingTrackId)} onClick={() => setModal(null)}>Giữ lại</button>
            <button className="danger-button" disabled={Boolean(deletingTrackId)} onClick={() => deleteTrack(modal.track)}>
              <Trash2 size={17} /> {deletingTrackId ? 'Đang xóa...' : 'Xóa bài hát'}
            </button>
          </div>
        </Modal>
      )}

      {toast && <div className={`toast ${toast.type}`}><Check size={17} />{toast.message}</div>}
    </div>
  );
}
