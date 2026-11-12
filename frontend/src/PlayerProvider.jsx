import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { PlayerContext } from './playerContext';

export function PlayerProvider({ children }) {
  const audioRef = useRef(null);
  const [queue, setQueue] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('off');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(() => Number(localStorage.getItem('sonora-volume') || 0.8));
  const [sleepEndsAt, setSleepEndsAtState] = useState(() => {
    const stored = Number(localStorage.getItem('sonora-sleep-ends-at'));
    if (stored > Date.now()) return stored;
    localStorage.removeItem('sonora-sleep-ends-at');
    return null;
  });

  const playTrack = useCallback((track, sourceQueue) => {
    if (sourceQueue?.length) setQueue(sourceQueue);
    setCurrentTrack(track);
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => setIsPlaying(false), []);
  const togglePlay = useCallback(() => {
    if (!currentTrack && queue.length) {
      setCurrentTrack(queue[0]);
      setIsPlaying(true);
      return;
    }
    setIsPlaying((value) => !value);
  }, [currentTrack, queue]);

  const move = useCallback((direction, fromEnded = false) => {
    if (!queue.length || !currentTrack) return;
    const currentIndex = queue.findIndex((track) => track.id === currentTrack.id);

    if (shuffle && queue.length > 1) {
      const candidates = queue.filter((track) => track.id !== currentTrack.id);
      setCurrentTrack(candidates[Math.floor(Math.random() * candidates.length)]);
      setIsPlaying(true);
      return;
    }

    let nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= queue.length) {
      if (repeat === 'all') nextIndex = nextIndex < 0 ? queue.length - 1 : 0;
      else {
        if (fromEnded) setIsPlaying(false);
        return;
      }
    }
    setCurrentTrack(queue[nextIndex]);
    setIsPlaying(true);
  }, [currentTrack, queue, repeat, shuffle]);

  const next = useCallback((fromEnded = false) => move(1, fromEnded), [move]);
  const previous = useCallback(() => {
    if (audioRef.current?.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    move(-1);
  }, [move]);

  const cycleRepeat = useCallback(() => {
    setRepeat((value) => (value === 'off' ? 'all' : value === 'all' ? 'one' : 'off'));
  }, []);

  const seek = useCallback((value) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Number(value);
    setCurrentTime(Number(value));
  }, []);

  const setVolume = useCallback((value) => {
    const nextVolume = Math.min(1, Math.max(0, Number(value)));
    setVolumeState(nextVolume);
    localStorage.setItem('sonora-volume', String(nextVolume));
  }, []);

  const setSleepTimer = useCallback((minutes) => {
    const endsAt = minutes > 0 ? Date.now() + minutes * 60_000 : null;
    setSleepEndsAtState(endsAt);
    if (endsAt) localStorage.setItem('sonora-sleep-ends-at', String(endsAt));
    else localStorage.removeItem('sonora-sleep-ends-at');
  }, []);

  const removeTrack = useCallback((trackId) => {
    setQueue((items) => items.filter((track) => track.id !== trackId));
    if (currentTrack?.id !== trackId) return;

    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    setCurrentTrack(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    audio.src = api.streamUrl(currentTrack.id);
    audio.load();
    setCurrentTime(0);
    setDuration(currentTrack.duration || 0);
  }, [currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (isPlaying) audio.play().catch(() => setIsPlaying(false));
    else audio.pause();
  }, [isPlaying, currentTrack]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (!sleepEndsAt) return undefined;
    const remaining = Math.max(0, sleepEndsAt - Date.now());
    const timeout = window.setTimeout(() => {
      setIsPlaying(false);
      setSleepEndsAtState(null);
      localStorage.removeItem('sonora-sleep-ends-at');
    }, remaining);
    return () => window.clearTimeout(timeout);
  }, [sleepEndsAt]);

  const onEnded = useCallback(() => {
    if (repeat === 'one' && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => setIsPlaying(false));
      return;
    }
    next(true);
  }, [next, repeat]);

  const value = useMemo(() => ({
    audioRef, queue, currentTrack, isPlaying, shuffle, repeat, currentTime, duration, volume, sleepEndsAt,
    playTrack, pause, togglePlay, next, previous, setShuffle, cycleRepeat, seek, setVolume, setSleepTimer, removeTrack,
    onTimeUpdate: (event) => setCurrentTime(event.currentTarget.currentTime),
    onLoadedMetadata: (event) => setDuration(event.currentTarget.duration || 0),
    onEnded,
  }), [queue, currentTrack, isPlaying, shuffle, repeat, currentTime, duration, volume, sleepEndsAt,
    playTrack, pause, togglePlay, next, previous, cycleRepeat, seek, setVolume, setSleepTimer, removeTrack, onEnded]);

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}
