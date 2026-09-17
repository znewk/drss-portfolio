import { useMemo, useState } from 'react';
import {
  EMPLOYEE_STATUSES, FORMATS, POSITIONS, RATES, cmpRu, employeeLoad, isWorking, loadTone, num, rateLabel,
} from '../model.js';
import { uid } from '../storage.js';
import { Field, Legend, LoadBar, Modal, SortTh, TypeTag } from './ui.jsx';
import { downloadXlsx } from '../xlsx.js';
import { employeesSheet } from '../reports.js';

const EMPTY = {
  name: '', position: 'Инженер', managerId: '', format: 'Офис', officeDays: 3,
  rate: 1, status: 'Активен', startDate: '', skills: '', note: '',
};

export default function Employees({ data, empById, api }) {
  const [q, setQ] = useState('');
  const [position, setPosition] = useState('');
  const [format, setFormat] = useState('');
  const [status, setStatus] = useState('');
  const [loadFilter, setLoadFilter] = useState('');
  const [sort, setSort] = useState({ key: 'name', dir: 1 });
  const [editing, setEditing] = useState(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = data.employees.map((e) => {
      const l = employeeLoad(e.id, data.projects);
      return { ...e, load: l.percent, items: l.items, count: l.items.length };
    }).filter((e) =>
      (!needle || e.name.toLowerCase().includes(needle)) &&
      (!position || e.position === position) &&
      (!format || e.format === format) &&
      (!status || e.status === status) &&
      (!loadFilter || loadTone(e.load) === loadFilter),
    );
    const k = sort.key;
    return list.sort((a, b) => {
      const r = typeof a[k] === 'number' ? a[k] - b[k] : cmpRu(a[k], b[k]);
      return r * sort.dir;
    });
  }, [data, q, position, format, status, loadFilter, sort]);

  const active = data.employees.filter(isWorking);
  const capacity = active.reduce((s, e) => s + Number(e.rate), 0);

  // Выгружаем то, что видно на экране: с учётом поиска, фильтров и сортировки.
  const exportXlsx = () =>
    downloadXlsx('сотрудники-дрсс', [employeesSheet(rows, data.projects, empById)]);

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Сотрудники</h1>
          <p className="sub">{data.employees.length} в списке, {active.length} активных, мощность {num(capacity, 2)} FTE</p>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={exportXlsx} disabled={!rows.length}>Скачать Excel</button>
          <button className="btn primary" onClick={() => setEditing({ ...EMPTY })}>Добавить сотрудника</button>
        </div>
      </div>

      <div className="toolbar">
        <input className="search" type="search" placeholder="Поиск по ФИО" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={position} onChange={(e) => setPosition(e.target.value)} aria-label="Должность">
          <option value="">Все должности</option>
          {POSITIONS.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select value={format} onChange={(e) => setFormat(e.target.value)} aria-label="Формат работы">
          <option value="">Любой формат</option>
          {FORMATS.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Статус">
          <option value="">Любой статус</option>
          {EMPLOYEE_STATUSES.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select value={loadFilter} onChange={(e) => setLoadFilter(e.target.value)} aria-label="Загрузка">
          <option value="">Любая загрузка</option>
          <option value="under">Недогружен (до 80%)</option>
          <option value="ok">Норма (80–100%)</option>
          <option value="over">Перегружен (больше 100%)</option>
        </select>
      </div>

      <Legend />

      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <SortTh label="ФИО" k="name" sort={sort} setSort={setSort} />
              <SortTh label="Должность" k="position" sort={sort} setSort={setSort} />
              <SortTh label="Формат" k="format" sort={sort} setSort={setSort} />
              <SortTh label="Ставка" k="rate" sort={sort} setSort={setSort} className="r" />
              <SortTh label="Статус" k="status" sort={sort} setSort={setSort} />
              <SortTh label="Проектов" k="count" sort={sort} setSort={setSort} className="r" />
              <SortTh label="Загрузка" k="load" sort={sort} setSort={setSort} className="w-load" />
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className={`clickable ${e.status === 'Уволен' ? 'dim' : ''}`} onClick={() => setEditing(e)}>
                <td><button className="link" onClick={(ev) => { ev.stopPropagation(); setEditing(e); }}>{e.name}</button></td>
                <td>{e.position}</td>
                <td>{e.format}{e.format === 'Гибрид' ? `, ${e.officeDays} дн. в офисе` : ''}</td>
                <td className="r num">{num(e.rate, 2)}</td>
                <td><span className="status" data-s={e.status}>{e.status}</span></td>
                <td className="r num">{e.count}</td>
                <td><LoadBar items={e.items} total={e.load} compact /></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="empty">Никого не нашлось. Измените поиск или фильтры.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <EmployeeForm
          initial={editing}
          data={data}
          empById={empById}
          onClose={() => setEditing(null)}
          onSave={(e) => { api.upsertEmployee(e); setEditing(null); }}
          onDelete={(id) => { api.deleteEmployee(id); setEditing(null); }}
        />
      )}
    </section>
  );
}

function EmployeeForm({ initial, data, onClose, onSave, onDelete }) {
  const isNew = !initial.id;
  const [f, setF] = useState(() => {
    const { load, items, count, ...rest } = initial;
    return rest;
  });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const load = isNew ? { percent: 0, items: [] } : employeeLoad(initial.id, data.projects);
  const managers = data.employees.filter((e) => e.id !== initial.id).sort((a, b) => cmpRu(a.name, b.name));

  const submit = () => {
    if (!f.name.trim()) return setError('Укажите ФИО.');
    onSave({ ...f, id: f.id || uid(), name: f.name.trim(), rate: Number(f.rate), officeDays: Number(f.officeDays) });
  };

  const remove = () => {
    const msg = load.items.length
      ? `У сотрудника ${load.items.length} назначений на проекты. Удалить сотрудника и снять его со всех проектов?\n\nЕсли нужно сохранить историю, лучше поставить статус «Уволен».`
      : 'Удалить сотрудника из списка?';
    if (window.confirm(msg)) onDelete(initial.id);
  };

  return (
    <Modal
      title={isNew ? 'Новый сотрудник' : f.name || 'Сотрудник'}
      onClose={onClose}
      footer={<>
        {!isNew && <button className="btn danger-ghost" onClick={remove}>Удалить</button>}
        <span className="grow" />
        <button className="btn" onClick={onClose}>Отмена</button>
        <button className="btn primary" onClick={submit}>{isNew ? 'Добавить' : 'Сохранить'}</button>
      </>}
    >
      <div className="form-grid">
        <Field label="ФИО" span>
          <input value={f.name} onChange={set('name')} autoFocus />
        </Field>
        <Field label="Должность">
          <select value={f.position} onChange={set('position')}>
            {POSITIONS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Руководитель">
          <select value={f.managerId} onChange={set('managerId')}>
            <option value="">Не указан</option>
            {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Формат работы">
          <select value={f.format} onChange={set('format')}>
            {FORMATS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        {f.format === 'Гибрид' ? (
          <Field label="Дней в офисе в неделю">
            <input type="number" min="1" max="4" value={f.officeDays} onChange={set('officeDays')} />
          </Field>
        ) : <span className="field-spacer" />}
        <Field label="Ставка" hint="Определяет мощность сотрудника в FTE">
          <select value={f.rate} onChange={set('rate')}>
            {RATES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </Field>
        <Field label="Статус" hint="В сводной учитываются только активные">
          <select value={f.status} onChange={set('status')}>
            {EMPLOYEE_STATUSES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Дата начала работы">
          <input type="date" value={f.startDate} onChange={set('startDate')} />
        </Field>
        <Field label="Компетенции" hint="Через запятую">
          <input value={f.skills} onChange={set('skills')} placeholder="Frontend, 1С, DevOps" />
        </Field>
        <Field label="Комментарий" span>
          <textarea rows={2} value={f.note} onChange={set('note')} />
        </Field>
      </div>

      {error && <p className="error">{error}</p>}

      {!isNew && (
        <div className="subsection">
          <h3>Участие в проектах</h3>
          {load.items.length === 0 ? (
            <p className="muted">Не назначен ни на один проект. Назначения делаются в карточке проекта.</p>
          ) : (
            <>
              <LoadBar items={load.items} total={load.percent} />
              <ul className="plain-list">
                {load.items.map((i) => (
                  <li key={i.project.id}>
                    <TypeTag type={i.project.type} />
                    <span className="grow">{i.project.name}</span>
                    <span className="num">{i.percent}%</span>
                    <span className="num muted">{num((i.percent / 100) * Number(f.rate), 2)} FTE</span>
                  </li>
                ))}
              </ul>
              <p className="muted small">Ставка: {rateLabel(f.rate)}</p>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
