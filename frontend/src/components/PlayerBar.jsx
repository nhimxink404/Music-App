import {
  Heart, ListMusic, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward,
  Timer, Volume1, Volume2, VolumeX,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePlayer } from '../playerContext';
import { formatTime } from '../utils';
import { SleepTimerModal } from './SleepTimerModal';

export function PlayerBar({ favoriteIds, onToggleFavorite }) {
  const player = usePlayer();
  const [showTimer, setShowTimer] = useState(false);
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    if (!player.sleepEndsAt) {
      setRemaining('');
      return undefined;
    }
    const update = () => {
      const seconds = Math.max(0, Math.ceil((player.sleepEndsAt - Date.now()) / 1000));
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const clock = `${String(minutes).padStart(hours ? 2 : 1, '0')}:${String(seconds % 60).padStart(2, '0')}`;
      setRemaining(hours ? `${hours}:${clock}` : clock);
    };
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [player.sleepEndsAt]);

  const track = player.currentTrack;
  const liked = track && favoriteIds.has(track.id);
  const VolumeIcon = player.volume === 0 ? VolumeX : player.volume < 0.5 ? Volume1 : Volume2;

  return (
    <>
      <footer className="player-bar" style={{ '--track-progress': `${player.duration ? (player.currentTime / player.duration) * 100 : 0}%` }}>
        <audio
          ref={player.audioRef}
          onTimeUpdate={player.onTimeUpdate}
          onLoadedMetadata={player.onLoadedMetadata}
          onEnded={player.onEnded}
          preload="metadata"
        />
        <div className="now-playing">
          <div className={`mini-cover ${track ? 'mini-vinyl' : ''} ${player.isPlaying ? 'is-spinning' : ''}`}>
            {track ? <img src="/music_logo.jpg" alt="" /> : <ListMusic size={23} />}
          </div>
          <div>
            <strong>{track?.title || 'Chọn một bài hát'}</strong>
            <span>{track?.artist || (track ? 'Sonora Library' : 'Thư viện của bạn')}</span>
          </div>
          {track && (
            <button className={`icon-button ${liked ? 'liked' : ''}`} onClick={() => onToggleFavorite(track)} aria-label="Yêu thích">
              <Heart size={17} fill={liked ? 'currentColor' : 'none'} />
            </button>
          )}
        </div>

        <div className="transport">
          <div className="transport-buttons">
            <button className={`icon-button ${player.shuffle ? 'active' : ''}`} onClick={() => player.setShuffle((value) => !value)} title="Phát ngẫu nhiên" aria-label="Phát ngẫu nhiên">
              <Shuffle size={17} />
            </button>
            <button className="icon-button" onClick={player.previous} title="Bài trước" aria-label="Bài trước"><SkipBack size={20} fill="currentColor" /></button>
            <button className={`main-play ${player.isPlaying ? 'playing' : ''}`} onClick={player.togglePlay} disabled={!track && !player.queue.length} aria-label={player.isPlaying ? 'Tạm dừng' : 'Phát'}>
              {player.isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>
            <button className="icon-button" onClick={() => player.next()} title="Bài tiếp" aria-label="Bài tiếp"><SkipForward size={20} fill="currentColor" /></button>
            <button className={`icon-button ${player.repeat !== 'off' ? 'active' : ''}`} onClick={player.cycleRepeat} title="Chế độ lặp" aria-label="Chế độ lặp">
              {player.repeat === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
            </button>
          </div>
          <div className="progress-row">
            <span>{formatTime(player.currentTime)}</span>
            <input
              className="range"
              type="range"
              min="0"
              max={player.duration || 0}
              step="0.1"
              value={Math.min(player.currentTime, player.duration || 0)}
              onChange={(event) => player.seek(event.target.value)}
              style={{ '--progress': `${player.duration ? (player.currentTime / player.duration) * 100 : 0}%` }}
              aria-label="Tiến trình bài hát"
            />
            <span>{formatTime(player.duration)}</span>
          </div>
        </div>

        <div className="player-tools">
          <button className={`timer-button ${remaining ? 'active' : ''}`} onClick={() => setShowTimer(true)} title="Hẹn giờ tắt nhạc">
            <Timer size={18} /><span>{remaining || 'Hẹn giờ'}</span>
          </button>
          <VolumeIcon size={18} />
          <input
            className="range volume-range"
            type="range" min="0" max="1" step="0.01" value={player.volume}
            onChange={(event) => player.setVolume(event.target.value)}
            style={{ '--progress': `${player.volume * 100}%` }}
            aria-label="Âm lượng"
          />
        </div>
      </footer>

      {showTimer && <SleepTimerModal onClose={() => setShowTimer(false)} />}
    </>
  );
}
