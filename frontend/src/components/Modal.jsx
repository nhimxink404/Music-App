import { X } from 'lucide-react';

export function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Đóng"><X size={20} /></button>
        </header>
        {children}
      </section>
    </div>
  );
}
