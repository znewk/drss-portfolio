import { useEffect, useRef } from 'react';
import { PROJECT_TYPES, loadTone, pct } from '../model.js';

export function Modal({ title, onClose, children, footer, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const first = ref.current?.querySelector('input, select, textarea, button');
    first?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть">×</button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function Field({ label, children, hint, span }) {
  return (
    <label className={`field ${span ? 'span-2' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

// Полоса загрузки: сегменты по проектам, цвет — по типу проекта.
// Шкала 0–100%, при перегрузке шкала растягивается до суммы.
export function LoadBar({ items, total, compact }) {
  const scale = Math.max(100, total);
  const tone = loadTone(total);
  return (
    <div className={`loadbar ${compact ? 'compact' : ''}`}>
      <div className="loadbar-track" title={items.map((i) => `${i.project.name}: ${i.percent}%`).join('\n') || 'Нет назначений'}>
        {items.map((i, idx) => (
          <span
            key={i.project.id + idx}
            className={`seg t-${i.project.type}`}
            style={{ width: `${(i.percent / scale) * 100}%` }}
          />
        ))}
        {total > 100 && <span className="limit" style={{ left: `${(100 / scale) * 100}%` }} />}
      </div>
      <span className={`loadbar-val tone-${tone}`}>{pct(total)}</span>
    </div>
  );
}

export function TypeTag({ type }) {
  return <span className={`tag t-${type}`}>{PROJECT_TYPES[type]?.label}</span>;
}

export function Legend() {
  return (
    <div className="legend">
      {Object.entries(PROJECT_TYPES).map(([k, v]) => (
        <span key={k}><i className={`dot t-${k}`} />{v.label}</span>
      ))}
    </div>
  );
}

export function SortTh({ label, k, sort, setSort, className }) {
  const active = sort.key === k;
  return (
    <th className={className} aria-sort={active ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
      <button className="th-btn" onClick={() => setSort({ key: k, dir: active ? -sort.dir : 1 })}>
        {label}<span className="sort-mark">{active ? (sort.dir > 0 ? '▲' : '▼') : ''}</span>
      </button>
    </th>
  );
}
