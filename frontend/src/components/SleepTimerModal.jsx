import { Clock3, Minus, Plus, TimerReset } from 'lucide-react';
import { useMemo, useState } from 'react';
import { usePlayer } from '../playerContext';
import { Modal } from './Modal';

const PRESETS = [15, 30, 45, 60, 90];
const CLOCK_TICKS = Array.from({ length: 12 }, (_value, index) => index);
const MAX_TIMER_MINUTES = 23 * 60 + 59;

function initialDuration(endsAt) {
  if (!endsAt) return 30;
  return Math.max(1, Math.min(MAX_TIMER_MINUTES, Math.ceil((endsAt - Date.now()) / 60_000)));
}

function splitDuration(totalMinutes) {
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

export function SleepTimerModal({ onClose }) {
  const player = usePlayer();
  const initial = splitDuration(initialDuration(player.sleepEndsAt));
  const [hours, setHours] = useState(initial.hours);
  const [minutes, setMinutes] = useState(initial.minutes);
  const totalMinutes = hours * 60 + minutes;

  const stopTime = useMemo(() => new Date(Date.now() + totalMinutes * 60_000), [totalMinutes]);
  const clockStyle = {
    '--hour-angle': `${((stopTime.getHours() % 12) + stopTime.getMinutes() / 60) * 30}deg`,
    '--minute-angle': `${stopTime.getMinutes() * 6}deg`,
  };

  const setDuration = (value) => {
    const next = splitDuration(Math.max(0, Math.min(MAX_TIMER_MINUTES, value)));
    setHours(next.hours);
    setMinutes(next.minutes);
  };

  const adjustDuration = (delta) => setDuration(totalMinutes + delta);
  const applyTimer = () => {
    if (totalMinutes < 1) return;
    player.setSleepTimer(totalMinutes);
    onClose();
  };

  return (
    <Modal title="Hẹn giờ tắt nhạc" onClose={onClose}>
      <div className="sleep-timer-layout">
        <div className="timer-clock" style={clockStyle} aria-hidden="true">
          {CLOCK_TICKS.map((tick) => <i key={tick} style={{ '--tick': tick }} />)}
          <span className="clock-hand hour-hand" />
          <span className="clock-hand minute-hand" />
          <span className="clock-pin"><Clock3 size={13} /></span>
        </div>

        <div className="timer-summary">
          <span>NHẠC SẼ DỪNG LÚC</span>
          <strong>{stopTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</strong>
          <p>{totalMinutes > 0 ? `Sau ${hours > 0 ? `${hours} giờ ` : ''}${minutes > 0 ? `${minutes} phút` : ''}` : 'Chọn thời gian'}</p>
        </div>
      </div>

      <div className="timer-presets" aria-label="Thời gian nhanh">
        {PRESETS.map((value) => (
          <button key={value} className={totalMinutes === value ? 'active' : ''} onClick={() => setDuration(value)}>
            {value >= 60 ? `${Math.floor(value / 60)}g${value % 60 ? ` ${value % 60}p` : ''}` : `${value}p`}
          </button>
        ))}
      </div>

      <div className="time-setter">
        <div className="time-unit">
          <span>GIỜ</span>
          <div>
            <button onClick={() => adjustDuration(-60)} aria-label="Giảm một giờ"><Minus size={17} /></button>
            <input
              type="number" min="0" max="23" value={hours}
              onChange={(event) => setHours(Math.max(0, Math.min(23, Number(event.target.value) || 0)))}
              aria-label="Số giờ"
            />
            <button onClick={() => adjustDuration(60)} aria-label="Tăng một giờ"><Plus size={17} /></button>
          </div>
        </div>
        <span className="time-colon">:</span>
        <div className="time-unit">
          <span>PHÚT</span>
          <div>
            <button onClick={() => adjustDuration(-5)} aria-label="Giảm năm phút"><Minus size={17} /></button>
            <input
              type="number" min="0" max="59" value={minutes}
              onChange={(event) => setMinutes(Math.max(0, Math.min(59, Number(event.target.value) || 0)))}
              aria-label="Số phút"
            />
            <button onClick={() => adjustDuration(5)} aria-label="Tăng năm phút"><Plus size={17} /></button>
          </div>
        </div>
      </div>

      <div className="timer-modal-actions">
        {player.sleepEndsAt && (
          <button className="secondary-button" onClick={() => { player.setSleepTimer(0); onClose(); }}>Hủy hẹn giờ</button>
        )}
        <button className="primary-button" disabled={totalMinutes < 1} onClick={applyTimer}>
          <TimerReset size={17} /> Bắt đầu hẹn giờ
        </button>
      </div>
    </Modal>
  );
}
