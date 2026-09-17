import { useMemo, useState } from 'react';
import {
  PROJECT_STATUSES, PROJECT_TYPES, TYPE_ORDER, assignmentFte, cmpRu, employeeLoad, loadTone, num, projectFte,
} from '../model.js';
import { uid } from '../storage.js';
import { Field, Modal, SortTh } from './ui.jsx';

const GROUPS = [
  { id: 'approved', label: 'Утверждённые', types: ['support', 'development'] },
  { id: 'unapproved', label: 'Неутверждённые', types: ['unapproved'] },
  { id: 'initiative', label: 'Инициативные', types: ['initiative'] },
];

const GROUP_NOTE = {
  support: 'Утверждённые проекты с финансированием: поддержка и эксплуатация систем.',
  development: 'Утверждённые проекты с финансированием: доработка и новый функционал.',
  unapproved: 'Работы без финансирования, выполняемые по поручению.',
  initiative: 'Внутренние проекты департамента по собственной инициативе.',
};

const BASIS_LABEL = {
  support: 'Договор / основание',
  development: 'Договор / основание',
  unapproved: 'Кто поручил, номер и дата поручения',
  initiative: 'Инициатор',
};

export default function Projects({ data, empById, api }) {
  const [group, setGroup] = useState('approved');
  const [sub, setSub] = useState('support');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState({ key: 'name', dir: 1 });
  const [editing, setEditing] = useState(null);

  const type = group === 'approved' ? sub : group;
  const countOf = (types) => data.projects.filter((p) => types.includes(p.type)).length;

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.projects
      .filter((p) => p.type === type)
      .filter((p) => !status || p.status === status)
      .filter((p) => !needle || `${p.name} ${p.code} ${p.customer}`.toLowerCase().includes(needle))
      .map((p) => ({
        ...p,
        fte: projectFte(p, empById),
        people: p.assignments.length,
        managerName: empById.get(p.managerId)?.name || '',
      }))
      .sort((a, b) => {
        const k = sort.key;
        const r = typeof a[k] === 'number' ? a[k] - b[k] : cmpRu(a[k], b[k]);
        return r * sort.dir;
      });
  }, [data.projects, empById, type, q, status, sort]);

  const totalFte = rows.reduce((s, r) => s + r.fte, 0);

  const newProject = () => setEditing({
    name: '', code: '', type, customer: '', managerId: '', status: 'В работе',
    startDate: '', endDate: '', basis: '', budget: '', plannedFte: '', note: '', assignments: [],
  });

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Проекты</h1>
          <p className="sub">{data.projects.length} в реестре</p>
        </div>
        <button className="btn primary" onClick={newProject}>Добавить проект</button>
      </div>

      <div className="tabs" role="tablist">
        {GROUPS.map((g) => (
          <button key={g.id} role="tab" aria-selected={group === g.id}
            className={`tab ${group === g.id ? 'on' : ''}`} onClick={() => setGroup(g.id)}>
            {g.label}<span className="count">{countOf(g.types)}</span>
          </button>
        ))}
      </div>

      {group === 'approved' && (
        <div className="subtabs" role="tablist">
          {['support', 'development'].map((t) => (
            <button key={t} role="tab" aria-selected={sub === t}
              className={`subtab t-${t} ${sub === t ? 'on' : ''}`} onClick={() => setSub(t)}>
              {PROJECT_TYPES[t].label}<span className="count">{countOf([t])}</span>
            </button>
          ))}
        </div>
      )}

      <p className="group-note">{GROUP_NOTE[type]}</p>

      <div className="toolbar">
        <input className="search" type="search" placeholder="Поиск по названию, коду, заказчику" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Статус">
          <option value="">Любой статус</option>
          {PROJECT_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <span className="grow" />
        <span className="toolbar-total">Итого на вкладке: <b className="num">{num(totalFte)} FTE</b></span>
      </div>

      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <SortTh label="Проект" k="name" sort={sort} setSort={setSort} />
              <SortTh label="Заказчик" k="customer" sort={sort} setSort={setSort} />
              <SortTh label="Руководитель" k="managerName" sort={sort} setSort={setSort} />
              <SortTh label="Статус" k="status" sort={sort} setSort={setSort} />
              <SortTh label="Людей" k="people" sort={sort} setSort={setSort} className="r" />
              <SortTh label="FTE" k="fte" sort={sort} setSort={setSort} className="r" />
              <SortTh label="Срок" k="endDate" sort={sort} setSort={setSort} />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className={`clickable ${p.status === 'Завершён' ? 'dim' : ''}`} onClick={() => setEditing(p)}>
                <td>
                  <button className="link" onClick={(ev) => { ev.stopPropagation(); setEditing(p); }}>{p.name}</button>
                  {p.code && <span className="code">{p.code}</span>}
                </td>
                <td>{p.customer}</td>
                <td>{p.managerName}</td>
                <td><span className="status" data-s={p.status}>{p.status}</span></td>
                <td className="r num">{p.people}</td>
                <td className="r num strong">{num(p.fte)}</td>
                <td className="num">{formatRange(p.startDate, p.endDate)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="empty">
                {q || status ? 'Ничего не нашлось по фильтрам.' : (
                  <>На этой вкладке пока нет проектов. <button className="link" onClick={newProject}>Добавить первый</button></>
                )}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <ProjectForm
          initial={editing}
          data={data}
          empById={empById}
          onClose={() => setEditing(null)}
          onSave={(p) => { api.upsertProject(p); setEditing(null); }}
          onDelete={(id) => { api.deleteProject(id); setEditing(null); }}
        />
      )}
    </section>
  );
}

function formatRange(a, b) {
  const f = (d) => (d ? new Date(d + 'T00:00').toLocaleDateString('ru-RU') : '');
  if (!a && !b) return '';
  return `${f(a) || '…'} – ${f(b) || '…'}`;
}

function ProjectForm({ initial, data, empById, onClose, onSave, onDelete }) {
  const isNew = !initial.id;
  const [f, setF] = useState(() => {
    const { fte, people, managerName, ...rest } = initial;
    return { ...rest, assignments: rest.assignments.map((a) => ({ ...a, key: uid() })) };
  });
  const [error, setError] = useState('');
  const [pick, setPick] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const isApproved = PROJECT_TYPES[f.type]?.group === 'approved';

  const people = useMemo(() => [...data.employees].sort((a, b) => cmpRu(a.name, b.name)), [data.employees]);
  const assigned = new Set(f.assignments.map((a) => a.employeeId));
  const available = people.filter((e) => !assigned.has(e.id) && e.status !== 'Уволен');

  const setAssignment = (key, patch) =>
    setF((x) => ({ ...x, assignments: x.assignments.map((a) => (a.key === key ? { ...a, ...patch } : a)) }));
  const removeAssignment = (key) =>
    setF((x) => ({ ...x, assignments: x.assignments.filter((a) => a.key !== key) }));
  const addAssignment = () => {
    if (!pick) return;
    const other = employeeLoad(pick, data.projects, initial.id).percent;
    const suggested = Math.max(0, Math.min(100, 100 - other)) || 10;
    setF((x) => ({ ...x, assignments: [...x.assignments, { key: uid(), employeeId: pick, percent: suggested }] }));
    setPick('');
  };

  const fte = f.assignments.reduce((s, a) => s + assignmentFte(a, empById), 0);
  const totalPct = f.assignments.reduce((s, a) => s + (Number(a.percent) || 0), 0);

  const submit = () => {
    if (!f.name.trim()) return setError('Укажите название проекта.');
    const bad = f.assignments.find((a) => !(Number(a.percent) > 0 && Number(a.percent) <= 100));
    if (bad) return setError('Доля участия каждого сотрудника должна быть от 1 до 100%.');
    onSave({
      ...f,
      id: f.id || uid(),
      name: f.name.trim(),
      assignments: f.assignments.map(({ key, ...a }) => ({ ...a, percent: Number(a.percent) })),
    });
  };

  const remove = () => {
    if (window.confirm(`Удалить проект «${f.name}»? Назначения сотрудников на него тоже удалятся.\n\nЧтобы сохранить историю, поставьте статус «Завершён».`)) {
      onDelete(initial.id);
    }
  };

  return (
    <Modal
      wide
      title={isNew ? 'Новый проект' : f.name || 'Проект'}
      onClose={onClose}
      footer={<>
        {!isNew && <button className="btn danger-ghost" onClick={remove}>Удалить</button>}
        <span className="grow" />
        <button className="btn" onClick={onClose}>Отмена</button>
        <button className="btn primary" onClick={submit}>{isNew ? 'Добавить' : 'Сохранить'}</button>
      </>}
    >
      <div className="form-grid">
        <Field label="Название" span>
          <input value={f.name} onChange={set('name')} />
        </Field>
        <Field label="Тип проекта" hint="Можно сменить, например, когда поручение получило финансирование">
          <select value={f.type} onChange={set('type')}>
            {TYPE_ORDER.map((t) => <option key={t} value={t}>{PROJECT_TYPES[t].full}</option>)}
          </select>
        </Field>
        <Field label="Код / краткое название">
          <input value={f.code} onChange={set('code')} />
        </Field>
        <Field label="Заказчик">
          <input value={f.customer} onChange={set('customer')} />
        </Field>
        <Field label="Руководитель проекта">
          <select value={f.managerId} onChange={set('managerId')}>
            <option value="">Не назначен</option>
            {people.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </Field>
        <Field label="Статус" hint="Завершённые не учитываются в загрузке">
          <select value={f.status} onChange={set('status')}>
            {PROJECT_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Плановый FTE">
          <input type="number" min="0" step="0.25" value={f.plannedFte} onChange={set('plannedFte')} />
        </Field>
        <Field label="Дата начала">
          <input type="date" value={f.startDate} onChange={set('startDate')} />
        </Field>
        <Field label="Дата окончания">
          <input type="date" value={f.endDate} onChange={set('endDate')} />
        </Field>
        <Field label={BASIS_LABEL[f.type]} span={!isApproved}>
          <input value={f.basis} onChange={set('basis')} />
        </Field>
        {isApproved && (
          <Field label="Бюджет, ₸">
            <input value={f.budget} onChange={set('budget')} inputMode="numeric" />
          </Field>
        )}
        <Field label="Описание" span>
          <textarea rows={2} value={f.note} onChange={set('note')} />
        </Field>
      </div>

      <div className="subsection">
        <div className="subsection-head">
          <h3>Команда</h3>
          <span className="muted">
            {f.assignments.length} чел., <b className="num">{num(fte)} FTE</b>
            {f.plannedFte !== '' && Number(f.plannedFte) > 0 && <> из {num(Number(f.plannedFte))} плановых</>}
          </span>
        </div>

        <div className="add-row">
          <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Сотрудник">
            <option value="">Выберите сотрудника…</option>
            {available.map((e) => {
              const l = employeeLoad(e.id, data.projects, initial.id).percent;
              return <option key={e.id} value={e.id}>{e.name}, занят на {l}%</option>;
            })}
          </select>
          <button className="btn" onClick={addAssignment} disabled={!pick}>Добавить в команду</button>
        </div>

        {f.assignments.length > 0 && (
          <table className="grid team">
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th className="r">Ставка</th>
                <th className="r">Доля, %</th>
                <th className="r">FTE</th>
                <th className="r">Итог загрузки</th>
                <th aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {f.assignments.map((a) => {
                const e = empById.get(a.employeeId);
                const other = employeeLoad(a.employeeId, data.projects, initial.id).percent;
                const total = other + (Number(a.percent) || 0);
                const countsHere = f.status !== 'Завершён';
                const shown = countsHere ? total : other;
                return (
                  <tr key={a.key}>
                    <td>{e?.name ?? 'Удалённый сотрудник'}<span className="muted small block">{e?.position}</span></td>
                    <td className="r num">{num(e?.rate ?? 0)}</td>
                    <td className="r">
                      <input className="pct-input" type="number" min="1" max="100" step="5"
                        value={a.percent} onChange={(ev) => setAssignment(a.key, { percent: ev.target.value })}
                        aria-label={`Доля участия ${e?.name ?? ''}`} />
                    </td>
                    <td className="r num">{num(assignmentFte(a, empById))}</td>
                    <td className={`r num tone-${loadTone(shown)}`}>
                      {shown}%{shown > 100 && <span className="small block">перегрузка</span>}
                    </td>
                    <td className="r">
                      <button className="icon-btn" onClick={() => removeAssignment(a.key)} aria-label={`Убрать ${e?.name ?? ''}`}>×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>Итого</td>
                <td />
                <td className="r num">{totalPct}%</td>
                <td className="r num strong">{num(fte)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        )}
        <p className="muted small">FTE = доля участия × ставка. «Итог загрузки» учитывает все незавершённые проекты сотрудника.</p>
      </div>

      {error && <p className="error">{error}</p>}
    </Modal>
  );
}
